import PropTypes from 'prop-types'
import PageForm from '../PageForm'
import PostForm from '../PostForm'

const PageManagerModals = ({ pageForm, postForm }) => {
  const shouldRenderPageForm = Boolean(pageForm?.mode)
  const shouldRenderPostForm = Boolean(postForm?.mode)

  if (!shouldRenderPageForm && !shouldRenderPostForm) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      {shouldRenderPageForm && (
        <PageForm
          mode={pageForm.mode}
          initialData={pageForm.data}
          submitting={pageForm.submitting}
          onSubmit={pageForm.submit}
          onCancel={pageForm.close}
        />
      )}
      {shouldRenderPostForm && (
        <PostForm
          mode={postForm.mode}
          initialData={postForm.data}
          submitting={postForm.submitting}
          onSubmit={postForm.submit}
          onCancel={postForm.close}
        />
      )}
    </div>
  )
}

const formShape = PropTypes.shape({
  mode: PropTypes.string,
  data: PropTypes.object,
  submitting: PropTypes.bool,
  submit: PropTypes.func.isRequired,
  close: PropTypes.func.isRequired,
})

PageManagerModals.propTypes = {
  pageForm: formShape,
  postForm: formShape,
}

PageManagerModals.defaultProps = {
  pageForm: null,
  postForm: null,
}

export default PageManagerModals
