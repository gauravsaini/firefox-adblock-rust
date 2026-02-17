use adblock::lists::{FilterFormat, FilterSet as FilterSetInternal, ParseOptions};
use adblock::resources::Resource;
use adblock::Engine as EngineInternal;
use std::cell::RefCell;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct WasmFilterSet {
    inner: RefCell<FilterSetInternal>,
}

#[wasm_bindgen]
impl WasmFilterSet {
    #[wasm_bindgen(constructor)]
    pub fn new(debug: bool) -> Self {
        Self {
            inner: RefCell::new(FilterSetInternal::new(debug)),
        }
    }

    #[wasm_bindgen(js_name = addFilters)]
    pub fn add_filters(&self, rules: &str, format: &str) -> Result<JsValue, JsValue> {
        let filter_format = match format {
            "hosts" => FilterFormat::Hosts,
            _ => FilterFormat::Standard,
        };
        let opts = ParseOptions {
            format: filter_format,
            ..ParseOptions::default()
        };
        let rule_list: Vec<String> = rules.lines().map(|s| s.to_string()).collect();
        let metadata = self.inner.borrow_mut().add_filters(&rule_list, opts);
        serde_wasm_bindgen::to_value(&metadata).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = addFilter)]
    pub fn add_filter(&self, rule: &str) -> bool {
        self.inner
            .borrow_mut()
            .add_filter(rule, ParseOptions::default())
            .is_ok()
    }
}

#[wasm_bindgen]
pub struct WasmEngine {
    inner: RefCell<EngineInternal>,
}

#[wasm_bindgen]
impl WasmEngine {
    #[wasm_bindgen(js_name = fromFilterSet)]
    pub fn from_filter_set(filter_set: &WasmFilterSet, optimize: bool) -> Self {
        let fs = filter_set.inner.borrow().clone();
        Self {
            inner: RefCell::new(EngineInternal::from_filter_set(fs, optimize)),
        }
    }

    pub fn check(
        &self,
        url: &str,
        source_url: &str,
        request_type: &str,
    ) -> Result<JsValue, JsValue> {
        let request = adblock::request::Request::new(url, source_url, request_type)
            .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let result = self.inner.borrow().check_network_request(&request);
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = urlCosmeticResources)]
    pub fn url_cosmetic_resources(&self, url: &str) -> Result<JsValue, JsValue> {
        let result = self.inner.borrow().url_cosmetic_resources(url);
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    #[wasm_bindgen(js_name = hiddenClassIdSelectors)]
    pub fn hidden_class_id_selectors(
        &self,
        classes: JsValue,
        ids: JsValue,
        exceptions: JsValue,
    ) -> Result<JsValue, JsValue> {
        let classes: Vec<String> =
            serde_wasm_bindgen::from_value(classes).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let ids: Vec<String> =
            serde_wasm_bindgen::from_value(ids).map_err(|e| JsValue::from_str(&e.to_string()))?;
        let exceptions: std::collections::HashSet<String> =
            serde_wasm_bindgen::from_value(exceptions)
                .map_err(|e| JsValue::from_str(&e.to_string()))?;
        let result = self
            .inner
            .borrow()
            .hidden_class_id_selectors(&classes, &ids, &exceptions);
        serde_wasm_bindgen::to_value(&result).map_err(|e| JsValue::from_str(&e.to_string()))
    }

    pub fn serialize(&self) -> Vec<u8> {
        self.inner.borrow().serialize()
    }

    pub fn deserialize(&self, data: &[u8]) -> Result<(), JsValue> {
        self.inner
            .borrow_mut()
            .deserialize(data)
            .map_err(|e| JsValue::from_str(&format!("{e:?}")))
    }

    #[wasm_bindgen(js_name = useResources)]
    pub fn use_resources(&self, resources_json: &str) -> Result<(), JsValue> {
        let resources: Vec<Resource> =
            serde_json::from_str(resources_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
        self.inner.borrow_mut().use_resources(resources);
        Ok(())
    }

    #[wasm_bindgen(js_name = enableTag)]
    pub fn enable_tag(&self, tag: &str) {
        self.inner.borrow_mut().enable_tags(&[tag]);
    }

    #[wasm_bindgen(js_name = disableTag)]
    pub fn disable_tag(&self, tag: &str) {
        self.inner.borrow_mut().disable_tags(&[tag]);
    }

    #[wasm_bindgen(js_name = tagExists)]
    pub fn tag_exists(&self, tag: &str) -> bool {
        self.inner.borrow().tag_exists(tag)
    }
}
