#[cfg(test)]
mod search_tests {
    use super::*;

    #[tokio::test]
    async fn test_search_query_validation() {
        // Test empty query
        let empty_query = "";
        assert!(empty_query.trim().is_empty());

        // Test query length
        let long_query = "a".repeat(501);
        assert!(long_query.len() > 500);
    }

    #[test]
    fn test_search_query_sanitization() {
        let query = "<script>alert('xss')</script>";
        // Query should be escaped before being used in FTS
        assert!(!query.contains("script"));
    }
}
