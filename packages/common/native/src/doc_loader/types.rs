use super::*;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct Document {
  pub page_content: String,
  pub metadata: HashMap<String, Value>,
  pub score: f64,
}

impl Document {
  /// Constructs a new `Document` with provided `page_content`, an empty `metadata` map and a `score` of 0.
  pub fn new<S: Into<String>>(page_content: S) -> Self {
    Document {
      page_content: page_content.into(),
      metadata: HashMap::new(),
      score: 0.0,
    }
  }

  /// Sets the `metadata` Map of the `Document` to the provided HashMap.
  pub fn with_metadata(mut self, metadata: HashMap<String, Value>) -> Self {
    self.metadata = metadata;
    self
  }

  /// Sets the `score` of the `Document` to the provided float.
  pub fn with_score(mut self, score: f64) -> Self {
    self.score = score;
    self
  }
}

impl Default for Document {
  /// Provides a default `Document` with an empty `page_content`, an empty `metadata` map and a `score` of 0.
  fn default() -> Self {
    Document {
      page_content: "".to_string(),
      metadata: HashMap::new(),
      score: 0.0,
    }
  }
}
