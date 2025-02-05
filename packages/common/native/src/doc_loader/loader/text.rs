use super::*;

#[derive(Debug, Clone)]
pub struct TextLoader {
  content: String,
}

impl TextLoader {
  pub fn new<T: Into<String>>(input: T) -> Self {
    Self {
      content: input.into(),
    }
  }
}

impl Loader for TextLoader {
  async fn load(self) -> Result<Vec<Document>, LoaderError> {
    let doc = Document::new(self.content);
    Ok(vec![doc])
  }
}
