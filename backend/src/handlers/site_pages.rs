use crate::{
    auth, db,
    models::{
        CreateSitePageRequest, ErrorResponse, NavigationItemResponse, NavigationResponse,
        SitePageListResponse, SitePageResponse, SitePageWithPostsResponse, SitePostDetailResponse,
        SitePostResponse, UpdateSitePageRequest,
    },
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;
use sqlx;

const MAX_TITLE_LEN: usize = 200;
const MAX_DESCRIPTION_LEN: usize = 1000;
const MAX_NAV_LABEL_LEN: usize = 100;
const MAX_JSON_BYTES: usize = 200_000;

fn ensure_admin(claims: &auth::Claims) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    if claims.role != "admin" {
        Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ))
    } else {
        Ok(())
    }
}

fn map_sqlx_error(err: sqlx::Error, context: &str) -> (StatusCode, Json<ErrorResponse>) {
    match err {
        sqlx::Error::RowNotFound => (
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: format!("{context} not found"),
            }),
        ),
        sqlx::Error::Protocol(e) => (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: e.to_string(),
            }),
        ),
        sqlx::Error::Database(db_err) => {
            if db_err.is_unique_violation() {
                (
                    StatusCode::CONFLICT,
                    Json(ErrorResponse {
                        error: db_err
                            .constraint()
                            .map(|c| format!("Duplicate value violates unique constraint '{c}'"))
                            .unwrap_or_else(|| {
                                "Duplicate value violates unique constraint".to_string()
                            }),
                    }),
                )
            } else {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: "Database error".to_string(),
                    }),
                )
            }
        }
        other => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Unexpected database error: {other}"),
            }),
        ),
    }
}

fn validate_json_size(value: &Value, field: &str) -> Result<(), (StatusCode, Json<ErrorResponse>)> {
    match serde_json::to_string(value) {
        Ok(serialized) if serialized.len() <= MAX_JSON_BYTES => Ok(()),
        Ok(_) => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("{field} JSON exceeds maximum size of {MAX_JSON_BYTES} bytes"),
            }),
        )),
        Err(err) => Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Invalid {field} JSON: {err}"),
            }),
        )),
    }
}

fn sanitize_create_payload(
    mut payload: CreateSitePageRequest,
) -> Result<CreateSitePageRequest, (StatusCode, Json<ErrorResponse>)> {
    payload.slug = payload.slug.trim().to_lowercase();
    if payload.slug.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Slug cannot be empty".to_string(),
            }),
        ));
    }

    payload.title = payload.title.trim().to_string();
    if payload.title.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Title cannot be empty".to_string(),
            }),
        ));
    }
    if payload.title.len() > MAX_TITLE_LEN {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Title too long (max {MAX_TITLE_LEN} characters)"),
            }),
        ));
    }

    payload.description = payload.description.map(|desc| desc.trim().to_string());
    if let Some(desc) = payload.description.as_ref() {
        if desc.len() > MAX_DESCRIPTION_LEN {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Description too long (max {MAX_DESCRIPTION_LEN} characters)"),
                }),
            ));
        }
    }

    payload.nav_label = payload.nav_label.and_then(|label| {
        let trimmed = label.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });
    if let Some(label) = payload.nav_label.as_ref() {
        if label.len() > MAX_NAV_LABEL_LEN {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!(
                        "Navigation label too long (max {MAX_NAV_LABEL_LEN} characters)"
                    ),
                }),
            ));
        }
    }

    validate_json_size(&payload.hero, "hero")?;
    validate_json_size(&payload.layout, "layout")?;

    Ok(payload)
}

fn sanitize_update_payload(
    mut payload: UpdateSitePageRequest,
) -> Result<UpdateSitePageRequest, (StatusCode, Json<ErrorResponse>)> {
    if let Some(ref mut slug) = payload.slug {
        *slug = slug.trim().to_lowercase();
        if slug.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Slug cannot be empty".to_string(),
                }),
            ));
        }
    }

    if let Some(ref mut title) = payload.title {
        *title = title.trim().to_string();
        if title.is_empty() {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: "Title cannot be empty".to_string(),
                }),
            ));
        }
        if title.len() > MAX_TITLE_LEN {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Title too long (max {MAX_TITLE_LEN} characters)"),
                }),
            ));
        }
    }

    if let Some(ref mut description) = payload.description {
        *description = description.trim().to_string();
        if description.len() > MAX_DESCRIPTION_LEN {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ErrorResponse {
                    error: format!("Description too long (max {MAX_DESCRIPTION_LEN} characters)"),
                }),
            ));
        }
    }

    if let Some(mut nav_label_option) = payload.nav_label.take() {
        nav_label_option = match nav_label_option {
            Some(label) => {
                let trimmed = label.trim().to_string();
                if trimmed.is_empty() {
                    None
                } else {
                    if trimmed.len() > MAX_NAV_LABEL_LEN {
                        return Err((
                            StatusCode::BAD_REQUEST,
                            Json(ErrorResponse {
                                error: format!(
                                    "Navigation label too long (max {MAX_NAV_LABEL_LEN} characters)"
                                ),
                            }),
                        ));
                    }
                    Some(trimmed)
                }
            }
            None => None,
        };

        payload.nav_label = Some(nav_label_option);
    }

    if let Some(ref hero) = payload.hero {
        validate_json_size(hero, "hero")?;
    }
    if let Some(ref layout) = payload.layout {
        validate_json_size(layout, "layout")?;
    }

    Ok(payload)
}

fn map_page(
    page: crate::models::SitePage,
) -> Result<SitePageResponse, (StatusCode, Json<ErrorResponse>)> {
    let crate::models::SitePage {
        id,
        slug,
        title,
        description,
        nav_label,
        show_in_nav,
        order_index,
        is_published,
        hero_json,
        layout_json,
        created_at,
        updated_at,
    } = page;

    let hero = serde_json::from_str::<Value>(&hero_json).map_err(|err| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to parse stored hero JSON: {err}"),
            }),
        )
    })?;

    let layout = serde_json::from_str::<Value>(&layout_json).map_err(|err| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ErrorResponse {
                error: format!("Failed to parse stored layout JSON: {err}"),
            }),
        )
    })?;

    let sanitized_title = match title.trim() {
        "" => slug.clone(),
        value => value.to_string(),
    };

    let sanitized_description = description.trim().to_string();

    let sanitized_nav_label = nav_label.and_then(|label| {
        let trimmed = label.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    });

    Ok(SitePageResponse {
        id,
        slug,
        title: sanitized_title,
        description: sanitized_description,
        nav_label: sanitized_nav_label,
        show_in_nav,
        order_index,
        is_published,
        hero,
        layout,
        created_at,
        updated_at,
    })
}

/// Maps a `db::SitePost` model to a `SitePostResponse`.
fn map_post(post: crate::models::SitePost) -> SitePostResponse {
    SitePostResponse {
        id: post.id,
        page_id: post.page_id,
        title: post.title,
        slug: post.slug,
        excerpt: post.excerpt,
        content_markdown: post.content_markdown,
        is_published: post.is_published,
        published_at: post.published_at,
        order_index: post.order_index,
        created_at: post.created_at,
        updated_at: post.updated_at,
    }
}

/// Lists all site pages. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims, used to enforce admin-only access.
/// * `State(pool)` - Database pool reference.
///
/// # Returns
///
/// JSON list response or an error tuple.
pub async fn list_site_pages(
    claims: auth::Claims,
    State(pool): State<db::DbPool>,
) -> Result<Json<SitePageListResponse>, (StatusCode, Json<ErrorResponse>)> {
    ensure_admin(&claims)?;

    let records = db::list_site_pages(&pool)
        .await
        .map_err(|err| map_sqlx_error(err, "Site page"))?;

    let mut items = Vec::with_capacity(records.len());
    for record in records {
        items.push(map_page(record)?);
    }

    Ok(Json(SitePageListResponse { items }))
}

/// Retrieves a single site page by its ID. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims, used to enforce admin-only access.
/// * `State(pool)` - Database pool reference.
/// * `Path(id)` - Page identifier to load.
///
/// # Returns
///
/// JSON response describing the page or an error tuple.
pub async fn get_site_page(
    claims: auth::Claims,
    State(pool): State<db::DbPool>,
    Path(id): Path<String>,
) -> Result<Json<SitePageResponse>, (StatusCode, Json<ErrorResponse>)> {
    ensure_admin(&claims)?;

    let record = db::get_site_page_by_id(&pool, &id)
        .await
        .map_err(|err| map_sqlx_error(err, "Site page"))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Site page not found".to_string(),
                }),
            )
        })?;

    Ok(Json(map_page(record)?))
}

/// Creates a new site page. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims.
/// * `State(pool)` - Database pool reference.
/// * `Json(payload)` - Page creation payload.
///
/// # Returns
///
/// JSON representation of the created page or an error tuple.
pub async fn create_site_page(
    claims: auth::Claims,
    State(pool): State<db::DbPool>,
    Json(payload): Json<CreateSitePageRequest>,
) -> Result<Json<SitePageResponse>, (StatusCode, Json<ErrorResponse>)> {
    ensure_admin(&claims)?;

    let payload = sanitize_create_payload(payload)?;

    let record = db::create_site_page(&pool, payload)
        .await
        .map_err(|err| map_sqlx_error(err, "Site page"))?;

    Ok(Json(map_page(record)?))
}

/// Updates an existing site page. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims.
/// * `State(pool)` - Database pool reference.
/// * `Path(id)` - Identifier of the page to update.
/// * `Json(payload)` - Partial update payload.
///
/// # Returns
///
/// JSON representation of the updated page or an error tuple.
pub async fn update_site_page(
    claims: auth::Claims,
    State(pool): State<db::DbPool>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateSitePageRequest>,
) -> Result<Json<SitePageResponse>, (StatusCode, Json<ErrorResponse>)> {
    ensure_admin(&claims)?;

    let payload = sanitize_update_payload(payload)?;

    let record = db::update_site_page(&pool, &id, payload)
        .await
        .map_err(|err| map_sqlx_error(err, "Site page"))?;

    Ok(Json(map_page(record)?))
}

/// Deletes a site page by its ID. (Admin only)
///
/// # Arguments
///
/// * `claims` - Authenticated user claims.
/// * `State(pool)` - Database pool reference.
/// * `Path(id)` - Identifier of the page to remove.
///
/// # Returns
///
/// `StatusCode::NO_CONTENT` on success or an error tuple.
pub async fn delete_site_page(
    claims: auth::Claims,
    State(pool): State<db::DbPool>,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, Json<ErrorResponse>)> {
    ensure_admin(&claims)?;

    db::delete_site_page(&pool, &id)
        .await
        .map_err(|err| map_sqlx_error(err, "Site page"))?;

    Ok(StatusCode::NO_CONTENT)
}

/// Retrieves a published page and its published posts by the page slug.
///
/// # Arguments
///
/// * `State(pool)` - Database pool reference.
/// * `Path(slug)` - Page slug to resolve.
///
/// # Returns
///
/// JSON response containing the page and its published posts or an error tuple.
pub async fn get_published_page_by_slug(
    State(pool): State<db::DbPool>,
    Path(slug): Path<String>,
) -> Result<Json<SitePageWithPostsResponse>, (StatusCode, Json<ErrorResponse>)> {
    let lookup_slug = slug.trim().to_lowercase();
    if lookup_slug.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Slug cannot be empty".to_string(),
            }),
        ));
    }

    let page = db::get_site_page_by_slug(&pool, &lookup_slug)
        .await
        .map_err(|err| map_sqlx_error(err, "Site page"))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Page not found".to_string(),
                }),
            )
        })?;

    if !page.is_published {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Page not published".to_string(),
            }),
        ));
    }

    let posts = db::list_published_posts_for_page(&pool, &page.id)
        .await
        .map_err(|err| map_sqlx_error(err, "Posts"))?;

    let mut post_responses = Vec::with_capacity(posts.len());
    for post in posts {
        post_responses.push(map_post(post));
    }

    Ok(Json(SitePageWithPostsResponse {
        page: map_page(page)?,
        posts: post_responses,
    }))
}

/// Retrieves the navigation menu structure, containing published pages marked for navigation.
///
/// # Arguments
///
/// * `State(pool)` - Database pool reference.
///
/// # Returns
///
/// JSON navigation payload or an error tuple.
pub async fn get_navigation(
    State(pool): State<db::DbPool>,
) -> Result<Json<NavigationResponse>, (StatusCode, Json<ErrorResponse>)> {
    let pages = db::list_nav_pages(&pool)
        .await
        .map_err(|err| map_sqlx_error(err, "Navigation"))?;

    let mut items = Vec::with_capacity(pages.len());
    for page in pages {
        items.push(NavigationItemResponse {
            id: page.id,
            slug: page.slug,
            label: page
                .nav_label
                .clone()
                .filter(|label| !label.trim().is_empty())
                .unwrap_or(page.title.clone()),
            order_index: page.order_index,
        });
    }

    Ok(Json(NavigationResponse { items }))
}

/// Retrieves a single published post by its parent page slug and its own slug.
///
/// # Arguments
///
/// * `State(pool)` - Database pool reference.
/// * `Path((page_slug, post_slug))` - Tuple of page slug and post slug.
///
/// # Returns
///
/// JSON response combining page and post metadata or an error tuple.
pub async fn get_published_post_by_slug(
    State(pool): State<db::DbPool>,
    Path((page_slug, post_slug)): Path<(String, String)>,
) -> Result<Json<SitePostDetailResponse>, (StatusCode, Json<ErrorResponse>)> {
    let lookup_page_slug = page_slug.trim().to_lowercase();
    let lookup_post_slug = post_slug.trim().to_lowercase();

    if lookup_page_slug.is_empty() || lookup_post_slug.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: "Slug cannot be empty".to_string(),
            }),
        ));
    }

    let page = db::get_site_page_by_slug(&pool, &lookup_page_slug)
        .await
        .map_err(|err| map_sqlx_error(err, "Site page"))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Page not found".to_string(),
                }),
            )
        })?;

    if !page.is_published {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ErrorResponse {
                error: "Page not published".to_string(),
            }),
        ));
    }

    let post = db::get_published_post_by_slug(&pool, &page.id, &lookup_post_slug)
        .await
        .map_err(|err| map_sqlx_error(err, "Post"))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(ErrorResponse {
                    error: "Post not found".to_string(),
                }),
            )
        })?;

    Ok(Json(SitePostDetailResponse {
        page: map_page(page)?,
        post: map_post(post),
    }))
}

/// Lists the slugs of all published pages, typically for sitemap generation.
///
/// # Arguments
///
/// * `State(pool)` - Database pool reference.
///
/// # Returns
///
/// JSON array of slug strings or an error tuple.
pub async fn list_published_page_slugs(
    State(pool): State<db::DbPool>,
) -> Result<Json<Vec<String>>, (StatusCode, Json<ErrorResponse>)> {
    let pages = db::list_published_pages(&pool)
        .await
        .map_err(|err| map_sqlx_error(err, "Navigation"))?;

    let slugs = pages.into_iter().map(|page| page.slug).collect();

    Ok(Json(slugs))
}
