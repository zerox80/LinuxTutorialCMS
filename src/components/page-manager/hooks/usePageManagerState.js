import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../../api/client'
import { useContent } from '../../../context/ContentContext'

const usePageManagerState = () => {
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

  const selectedPage = useMemo(
    () => pages.find((item) => item.id === selectedPageId) ?? null,
    [pages, selectedPageId],
  )

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      pagesAbortRef.current?.abort()
      postsAbortRef.current?.abort()
    }
  }, [])

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
    loadPosts(selectedPageId ?? null)
  }, [selectedPageId, loadPosts])

  const handleCreatePage = useCallback(() => {
    setPageFormMode('create')
    setPageFormData(null)
  }, [])

  const handleEditPage = useCallback((page) => {
    setPageFormMode('edit')
    setPageFormData(page)
  }, [])

  const handleDeletePage = useCallback(
    async (page) => {
      const pageId = page?.id
      if (!pageId) {
        return
      }
      if (
        !window.confirm(
          'Soll diese Seite wirklich geloescht werden? Alle zugehoerigen Beitraege werden ebenfalls entfernt.',
        )
      ) {
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
        alert(err?.message || 'Seite konnte nicht geloescht werden')
      }
    },
    [loadPages, refreshNavigation, publishedPages],
  )

  const submitPageForm = useCallback(
    async (payload) => {
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
    },
    [pageFormMode, pageFormData, loadPages, refreshNavigation, publishedPages],
  )

  const handleCreatePost = useCallback(() => {
    if (!selectedPage) return
    setPostFormMode('create')
    setPostFormData(null)
  }, [selectedPage])

  const handleEditPost = useCallback((post) => {
    setPostFormMode('edit')
    setPostFormData(post)
  }, [])

  const handleDeletePost = useCallback(
    async (post) => {
      if (!window.confirm('Soll dieser Beitrag wirklich geloescht werden?')) {
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
        alert(err?.message || 'Beitrag konnte nicht geloescht werden')
      }
    },
    [loadPosts, selectedPageId, selectedPage, publishedPages],
  )

  const submitPostForm = useCallback(
    async (payload) => {
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
    },
    [postFormMode, postFormData, selectedPageId, selectedPage, publishedPages, loadPosts, refreshNavigation],
  )

  const closePageForm = useCallback(() => {
    setPageFormMode(null)
    setPageFormData(null)
  }, [])

  const closePostForm = useCallback(() => {
    setPostFormMode(null)
    setPostFormData(null)
  }, [])

  const refreshPosts = useCallback(() => {
    loadPosts(selectedPageId ?? null)
  }, [loadPosts, selectedPageId])

  return {
    navigation,
    publishedSlugList,
    pages,
    loading,
    error,
    selectedPage,
    selectedPageId,
    setSelectedPageId,
    posts,
    postsLoading,
    postsError,
    pageForm: {
      mode: pageFormMode,
      data: pageFormData,
      submitting: pageFormSubmitting,
      close: closePageForm,
      submit: submitPageForm,
      openCreate: handleCreatePage,
      openEdit: handleEditPage,
    },
    postForm: {
      mode: postFormMode,
      data: postFormData,
      submitting: postFormSubmitting,
      close: closePostForm,
      submit: submitPostForm,
      openCreate: handleCreatePost,
      openEdit: handleEditPost,
    },
    postsActions: {
      refresh: refreshPosts,
      delete: handleDeletePost,
    },
    pagesActions: {
      refresh: loadPages,
      delete: handleDeletePage,
    },
    refreshNavigation,
  }
}

export default usePageManagerState
