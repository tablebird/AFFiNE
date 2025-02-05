use affine_common::doc_loader::Doc;
use napi::{Env, JsObject, Result};

#[napi]
pub async fn parse_doc(file_path: String, doc: &[u8]) -> Option<Document> {
  let doc = Doc::new(&file_path, doc).await?;
  Some(Document { inner: doc })
}

#[napi]
pub struct Document {
  inner: Doc,
}

#[napi]
impl Document {
  #[napi(getter)]
  pub fn name(&self) -> String {
    self.inner.name.clone()
  }

  #[napi(getter, ts_return_type = "Array<{index: number, content: string}>")]
  pub fn chunks(&self, env: Env) -> Result<JsObject> {
    let mut array = env.create_array_with_length(self.inner.chunks.len())?;
    for (i, chunk) in self.inner.chunks.iter().enumerate() {
      let mut obj = env.create_object()?;
      obj.set_named_property("index", i as i64)?;
      obj.set_named_property("content", chunk.content.clone())?;
      array.set_element(i as u32, obj)?;
    }
    Ok(array)
  }
}
