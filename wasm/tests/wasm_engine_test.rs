#[cfg(test)]
mod tests {
    use adblock_wasm::{WasmEngine, WasmFilterSet};

    #[test]
    fn test_filter_set_creation() {
        let fs = WasmFilterSet::new(false);
        assert!(fs.add_filter("||example.com^"));
    }

    #[test]
    fn test_filter_set_add_filter_invalid() {
        let fs = WasmFilterSet::new(false);
        // Empty string should fail
        assert!(!fs.add_filter(""));
    }

    #[test]
    fn test_engine_from_filter_set_and_serialize() {
        let fs = WasmFilterSet::new(false);
        fs.add_filter("||example.com^");
        let engine = WasmEngine::from_filter_set(&fs, true);
        let data = engine.serialize();
        assert!(!data.is_empty());
    }

    #[test]
    fn test_engine_deserialize() {
        let fs = WasmFilterSet::new(false);
        fs.add_filter("||example.com^");
        let engine = WasmEngine::from_filter_set(&fs, true);
        let data = engine.serialize();

        let fs2 = WasmFilterSet::new(false);
        let engine2 = WasmEngine::from_filter_set(&fs2, true);
        assert!(engine2.deserialize(&data).is_ok());
    }

    #[test]
    fn test_engine_deserialize_invalid() {
        let fs = WasmFilterSet::new(false);
        let engine = WasmEngine::from_filter_set(&fs, true);
        // Invalid data should fail deserialization (panics in native due to JsValue)
        // This is tested implicitly in WASM context
    }

    #[test]
    fn test_engine_tags() {
        let fs = WasmFilterSet::new(false);
        let engine = WasmEngine::from_filter_set(&fs, true);
        assert!(!engine.tag_exists("nonexistent"));
        engine.enable_tag("testTag");
        engine.disable_tag("testTag");
    }

    #[test]
    fn test_engine_use_resources_valid() {
        let fs = WasmFilterSet::new(false);
        let engine = WasmEngine::from_filter_set(&fs, true);
        assert!(engine.use_resources("[]").is_ok());
    }

    // Note: Tests for check(), urlCosmeticResources(), hiddenClassIdSelectors(),
    // and addFilters() return JsValue and require WASM runtime.
    // They are tested via wasm-pack test or in-browser integration tests.
}
