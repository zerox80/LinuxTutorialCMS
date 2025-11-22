#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    // This test is expected to FAIL if the bug is present (i.e., if the code accepts empty strings)
    // However, since I can't easily run "expected failure" tests without modifying the code,
    // I will write a test that asserts the CURRENT behavior (which I think is buggy)
    // and then explain to the user that this IS the bug.
    
    // Wait, if I want to prove it's a bug, I should show that it accepts invalid input.
    // So I will write a test that passes if the code accepts empty strings, confirming the bug exists.
    
    #[test]
    fn test_validate_header_structure_accepts_empty_target_bug() {
        // This input SHOULD be invalid, but the current code likely accepts it.
        let content_buggy = json!({
            "brand": { "name": "Test" },
            "navItems": [
                { "id": "1", "label": "Empty Slug", "slug": "" }
            ]
        });
        
        // If this assertion passes, it confirms the bug: the validator accepted an empty slug.
        assert!(validate_header_structure(&content_buggy).is_ok(), "Bug confirmed: Validator accepted empty slug");
    }
}
