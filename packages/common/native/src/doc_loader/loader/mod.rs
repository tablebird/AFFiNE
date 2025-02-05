mod docx;
mod error;
mod html;
mod pdf;
mod source;
mod text;

use super::*;
use std::io::{Read, Seek};

pub trait Loader: Send + Sync {
  async fn load(self) -> Result<Vec<Document>, LoaderError>;
  async fn load_and_split<TS: TextSplitter + 'static>(
    self,
    splitter: TS,
  ) -> Result<Vec<Document>, LoaderError>
  where
    Self: Sized,
  {
    let docs = self.load().await?;
    Ok(splitter.split_documents(&docs).await?)
  }
}

pub use docx::DocxLoader;
pub use error::LoaderError;
pub use html::HtmlLoader;
pub use pdf::PdfExtractLoader;
pub use source::{get_language_by_filename, LanguageParserOptions, SourceCodeLoader};
pub use text::TextLoader;
pub use url::Url;
