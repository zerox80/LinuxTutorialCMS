import { Link } from 'react-router-dom'
import { CalendarDays, ArrowRight } from 'lucide-react'
import PropTypes from 'prop-types'
import { formatDate, normalizeSlug, buildPreviewText } from '../../utils/postUtils'

const PostCard = ({ post, pageSlug }) => {
    const publishedDate = formatDate(post.published_at)
    const previewText = buildPreviewText(post)
    const postSlug = normalizeSlug(post?.slug)

    return (
        <article
            className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm hover:shadow-md transition-shadow duration-200"
        >
            <div className="px-6 py-7 sm:px-9 sm:py-8 space-y-6">
                <header className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 dark:text-slate-400">
                        {publishedDate && (
                            <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="w-4 h-4" />
                                {publishedDate}
                            </span>
                        )}
                    </div>
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-slate-100 break-words">{post.title}</h3>
                    {previewText && (
                        <p className="text-gray-600 dark:text-slate-300 leading-relaxed break-words line-clamp-3">
                            {previewText}
                        </p>
                    )}
                </header>
                <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-slate-800">
                    <span className="text-sm text-gray-500 dark:text-slate-400">
                        {previewText ? 'Kurzvorschau' : 'Mehr Details verfügbar'}
                    </span>
                    {postSlug ? (
                        <Link
                            to={`/pages/${pageSlug}/posts/${postSlug}`}
                            className="inline-flex items-center gap-2 text-primary-700 dark:text-primary-300 font-semibold hover:text-primary-800 dark:hover:text-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:rounded-lg"
                        >
                            Weiterlesen
                            <ArrowRight className="w-4 h-4" />
                        </Link>
                    ) : null}
                </div>
            </div>
        </article>
    )
}

PostCard.propTypes = {
    post: PropTypes.object.isRequired,
    pageSlug: PropTypes.string.isRequired,
}

export default PostCard
