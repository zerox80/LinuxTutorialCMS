use crate::{
    security::auth,
    models::{ErrorResponse, UploadResponse},
};
use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    Json,
};
use std::path::PathBuf;
use tokio::fs;
use uuid::Uuid;

const MAX_FILE_SIZE: usize = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXTENSIONS: &[&str] = &["jpg", "jpeg", "png", "gif", "webp"];

pub async fn upload_image(
    claims: auth::Claims,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>, (StatusCode, Json<ErrorResponse>)> {
    // Ensure user is admin
    if claims.role != "admin" {
        return Err((
            StatusCode::FORBIDDEN,
            Json(ErrorResponse {
                error: "Insufficient permissions".to_string(),
            }),
        ));
    }

    while let Some(field) = multipart.next_field().await.map_err(|err| {
        (
            StatusCode::BAD_REQUEST,
            Json(ErrorResponse {
                error: format!("Failed to process multipart field: {}", err),
            }),
        )
    })? {
        let name = field.name().unwrap_or("").to_string();

        if name == "file" {
            let file_name = field.file_name().unwrap_or("unknown").to_string();

            // Simple extension validation
            let ext = std::path::Path::new(&file_name)
                .extension()
                .and_then(|os_str| os_str.to_str())
                .unwrap_or("")
                .to_lowercase();

            if !ALLOWED_EXTENSIONS.contains(&ext.as_str()) {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: format!("Invalid file extension. Allowed: {:?}", ALLOWED_EXTENSIONS),
                    }),
                ));
            }

            let mut data = Vec::new();
            while let Some(chunk) = field.chunk().await.map_err(|err| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: format!("Failed to read file chunk: {}", err),
                    }),
                )
            })? {
                if data.len() + chunk.len() > MAX_FILE_SIZE {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(ErrorResponse {
                            error: format!("File too large. Max size: {} bytes", MAX_FILE_SIZE),
                        }),
                    ));
                }
                data.extend_from_slice(&chunk);
            }

            // Validate file content using magic bytes
            if let Some(kind) = infer::get(&data) {
                let mime = kind.mime_type();
                let detected_ext = kind.extension();

                // Verify the detected extension matches our allowed list
                if !ALLOWED_EXTENSIONS.contains(&detected_ext) {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(ErrorResponse {
                            error: format!(
                                "File type '{}' not allowed. Detected: {}",
                                detected_ext, mime
                            ),
                        }),
                    ));
                }

                // Verify the detected extension matches the file extension (prevent spoofing)
                // Note: infer might return "jpeg" for "jpg", so we need to be flexible or normalize
                let normalized_detected = if detected_ext == "jpeg" {
                    "jpg"
                } else {
                    detected_ext
                };
                let normalized_ext = if ext == "jpeg" { "jpg" } else { ext.as_str() };

                if normalized_detected != normalized_ext {
                    return Err((
                        StatusCode::BAD_REQUEST,
                        Json(ErrorResponse {
                            error: format!(
                                "File extension mismatch. Expected '{}', but detected '{}'",
                                ext, detected_ext
                            ),
                        }),
                    ));
                }
            } else {
                return Err((
                    StatusCode::BAD_REQUEST,
                    Json(ErrorResponse {
                        error: "Could not determine file type".to_string(),
                    }),
                ));
            }

            let new_filename = format!("{}.{}", Uuid::new_v4(), ext);
            let upload_dir = std::env::var("UPLOAD_DIR").unwrap_or_else(|_| "uploads".to_string());
            let mut upload_path = PathBuf::from(upload_dir);

            // Ensure uploads directory exists
            if !upload_path.exists() {
                fs::create_dir_all(&upload_path).await.map_err(|err| {
                    (
                        StatusCode::INTERNAL_SERVER_ERROR,
                        Json(ErrorResponse {
                            error: format!("Failed to create uploads directory: {}", err),
                        }),
                    )
                })?;
            }

            upload_path.push(&new_filename);

            fs::write(&upload_path, data).await.map_err(|err| {
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(ErrorResponse {
                        error: format!("Failed to save file: {}", err),
                    }),
                )
            })?;

            let url = format!("/uploads/{}", new_filename);

            return Ok(Json(UploadResponse { url }));
        }
    }

    Err((
        StatusCode::BAD_REQUEST,
        Json(ErrorResponse {
            error: "No file found in request".to_string(),
        }),
    ))
}
