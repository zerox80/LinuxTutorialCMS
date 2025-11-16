import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Plus, RefreshCw } from 'lucide-react'
import { api } from '../../api/client'
import { useContent } from '../../context/ContentContext'
import PageForm from './PageForm'
import PostForm from './PostForm'
import PostsPanel from './PostsPanel'
import PageStats from './PageStats'
import PageList from './PageList'

const PageManager = () => {
  const { navigation, pages: publishedPages } = useContent()
  const [pages, setPages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedPageId, setSelectedPageId] = useState(null)
  const [pageFormMode, setPageFormMode] = useState(null)
  const [pageFormData, setPageFormData] = useState(null)
  const [pageFormSubmitting, setPageFormSubmitting] = useState(false)
  const [posts, setPosts] = useState([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [postsError, setPostsError] = useState(null)
  const postsRequestRef = useRef(0)
  const [postFormMode, setPostFormMode] = useState(null)
  const [postFormData, setPostFormData] = useState(null)
  const [postFormSubmitting, setPostFormSubmitting] = useState(false)
  const pagesAbortRef = useRef(null)
  const postsAbortRef = useRef(null)
  const isMountedRef = useRef(true)
  const normalizedPublishedSlugs = useMemo(() => {
    if (!Array.isArray(publishedPages?.publishedSlugs)) {
      return new Set()
    }
    return new Set(
      publishedPages.publishedSlugs
        .map((slug) => (typeof slug === 'string' ? slug.trim().toLowerCase() : ''))
        .filter(Boolean),
    )
  }, [publishedPages?.publishedSlugs])
  const publishedSlugList = useMemo(() => Array.from(normalizedPublishedSlugs).sort(), [normalizedPublishedSlugs])
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      pagesAbortRef.current?.abort()
      postsAbortRef.current?.abort()
    }
  }, [])
  const selectedPage = useMemo(
    () => pages.find((item) => item.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  )
  const loadPages = useCallback(async () => {
    const controller = new AbortController()
    if (pagesAbortRef.current) {
      pagesAbortRef.current.abort()
    }
    pagesAbortRef.current = controller
    try {
      setLoading(true)
      setError(null)
      const data = await api.listPages({ signal: controller.signal })
      if (controller.signal.aborted || !isMountedRef.current) {
        return
      }
      const items = Array.isArray(data?.items) ? data.items : []
      setPages(items)
      if (items.length === 0) {
        postsRequestRef.current += 1
        setSelectedPageId(null)
        setPosts([])
        setPostsError(null)
        setPostsLoading(false)
        return
      }
      if (!items.find((item) => item.id === selectedPageId)) {
        setSelectedPageId(items[0].id)
      }
    } catch (err) {
      if (!controller.signal.aborted && isMountedRef.current) {
        setError(err)
      }
    } finally {
      if (pagesAbortRef.current === controller) {
        pagesAbortRef.current = null
        if (isMountedRef.current) {
          setLoading(false)
        }
      }
    }
  }, [selectedPageId])
  const refreshNavigation = useCallback(() => {
    navigation?.refresh?.()
    publishedPages?.refresh?.()
  }, [navigation, publishedPages])
  const loadPosts = useCallback(
    async (pageId) => {
      if (!pageId) {
        postsRequestRef.current += 1
        if (postsAbortRef.current) {
          postsAbortRef.current.abort()
          postsAbortRef.current = null
        }
        setPosts([])
        setPostsLoading(false)
        setPostsError(null)
        return
      }
      const controller = new AbortController()
      if (postsAbortRef.current) {
        postsAbortRef.current.abort()
      }
      postsAbortRef.current = controller
      const requestId = postsRequestRef.current + 1
      postsRequestRef.current = requestId
      setPostsLoading(true)
      setPostsError(null)
      try {
        const data = await api.listPosts(pageId, { signal: controller.signal })
        if (controller.signal.aborted || postsRequestRef.current !== requestId || !isMountedRef.current) {
          return
        }
        const items = Array.isArray(data?.items) ? data.items : []
        setPosts(items)
      } catch (err) {
        if (!controller.signal.aborted && postsRequestRef.current === requestId && isMountedRef.current) {
          setPostsError(err)
        }
      } finally {
        if (postsAbortRef.current === controller) {
          postsAbortRef.current = null
        }
        if (!controller.signal.aborted && postsRequestRef.current === requestId && isMountedRef.current) {
          setPostsLoading(false)
        }
      }
    },
    [],
  )
  useEffect(() => {
    loadPages()
  }, [loadPages])
  useEffect(() => {
    if (selectedPageId) {
      loadPosts(selectedPageId)
    }
  }, [selectedPageId, loadPosts])
  const handleCreatePage = () => {
    setPageFormMode('create')
    setPageFormData(null)
  }
  const handleEditPage = (page) => {
    setPageFormMode('edit')
    setPageFormData(page)
  }
  const handleDeletePage = async (page) => {
    const pageId = page?.id
    if (!pageId) {
      return
    }
    if (!window.confirm('Soll diese Seite wirklich gelÃ¶scht werden? Alle zugehÃ¶rigen BeitrÃ¤ge werden ebenfalls entfernt.')) {
      return
    }
    try {
      const pageSlug = page?.slug
      await api.deletePage(pageId)
      if (pageSlug) {
        publishedPages?.invalidate?.(pageSlug)
      } else {
        publishedPages?.invalidate?.()
      }
      await loadPages()
      refreshNavigation()
    } catch (err) {
      alert(err?.message || 'Seite konnte nicht gelÃ¶scht werden')
    }
  }
  const submitPageForm = async (payload) => {
    try {
      setPageFormSubmitting(true)
      let response
      if (pageFormMode === 'edit' && pageFormData?.id) {
        response = await api.updatePage(pageFormData.id, payload)
      } else {
        response = await api.createPage(payload)
      }
      const previousSlug = pageFormMode === 'edit' ? pageFormData?.slug : null
      const nextSlug = response?.slug ?? payload?.slug ?? previousSlug
      if (previousSlug && previousSlug !== nextSlug) {
        publishedPages?.invalidate?.(previousSlug)
      }
      if (nextSlug) {
        publishedPages?.invalidate?.(nextSlug)
      }
      setPageFormMode(null)
      setPageFormData(null)
      await loadPages()
      refreshNavigation()
      publishedPages?.refresh?.()
    } finally {
      setPageFormSubmitting(false)
    }
  }
  const handleCreatePost = () => {
    if (!selectedPage) return
    setPostFormMode('create')
    setPostFormData(null)
  }
  const handleEditPost = (post) => {
    setPostFormMode('edit')
    setPostFormData(post)
  }
  const handleDeletePost = async (post) => {
    if (!window.confirm('Soll dieser Beitrag wirklich gelÃ¶scht werden?')) {
      return
    }
    try {
      await api.deletePost(post.id)
      if (selectedPage?.slug) {
        publishedPages?.invalidate?.(selectedPage.slug)
      } else {
        publishedPages?.invalidate?.()
      }
      await loadPosts(selectedPageId)
    } catch (err) {
      alert(err?.message || 'Beitrag konnte nicht gelÃ¶scht werden')
    }
  }
  const submitPostForm = async (payload) => {
    if (!selectedPageId) {
      return
    }
    try {
      setPostFormSubmitting(true)
      if (postFormMode === 'edit' && postFormData?.id) {
        await api.updatePost(postFormData.id, payload)
      } else {
        await api.createPost(selectedPageId, payload)
      }
      if (selectedPage?.slug) {
        publishedPages?.invalidate?.(selectedPage.slug)
      } else {
        publishedPages?.invalidate?.()
      }
      setPostFormMode(null)
      setPostFormData(null)
      await loadPosts(selectedPageId)
      refreshNavigation()
    } finally {
      setPostFormSubmitting(false)
    }
  }
  const closePageForm = () => {
    setPageFormMode(null)
    setPageFormData(null)
  }
  const closePostForm = () => {
    setPostFormMode(null)
    setPostFormData(null)
  }
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Seiten & BeitrÃ¤ge</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Verwalte dynamische Seiten, NavigationseintrÃ¤ge und verÃ¶ffentlichte BeitrÃ¤ge.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={loadPages}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Seiten aktualisieren
          </button>
          <button
            onClick={handleCreatePage}
            className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-600 to-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg hover:from-primary-700 hover:to-primary-800"
          >
            <Plus className="h-4 w-4" /> Neue Seite
          </button>
        </div>
      </div>
      <PageStats
        navigation={navigation}
        publishedSlugs={publishedSlugList}
        pages={pages}
        selectedPage={selectedPage}
      />
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertCircle className="h-4 w-4" />
          <div>
            <p className="font-semibold">Seiten konnten nicht geladen werden</p>
            <p>{error?.message || 'Unbekannter Fehler'}</p>
          </div>
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <PageList
          pages={pages}
          loading={loading}
          selectedPageId={selectedPageId}
          onSelect={setSelectedPageId}
          onEdit={handleEditPage}
          onDelete={handleDeletePage}
        />
        <div>
          {selectedPage ? (
            <PostsPanel
              page={selectedPage}
              posts={posts}
              loading={postsLoading}
              error={postsError}
              onCreate={handleCreatePost}
              onEdit={handleEditPost}
              onDelete={handleDeletePost}
              onRefresh={() => loadPosts(selectedPageId)}
            />
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-10 text-center text-gray-500">
              Wähle eine Seite aus, um ihre Beiträge zu verwalten.
            </div>
          )}
        </div>
      </div>
      {(pageFormMode || postFormMode) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          {pageFormMode && (
            <PageForm
              mode={pageFormMode}
              initialData={pageFormData}
              submitting={pageFormSubmitting}
              onSubmit={submitPageForm}
              onCancel={closePageForm}
            />
          )}
          {postFormMode && (
            <PostForm
              mode={postFormMode}
              initialData={postFormData}
              submitting={postFormSubmitting}
              onSubmit={submitPostForm}
              onCancel={closePostForm}
            />
          )}
        </div>
      )}
    </div>
  )
}
export default PageManager








