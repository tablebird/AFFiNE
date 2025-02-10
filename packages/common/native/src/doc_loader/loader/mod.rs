mod docx;
mod error;
mod html;
mod pdf;
mod source;
mod text;

use std::io::{Read, Seek};

use super::*;

// modified from https://github.com/Abraxas-365/langchain-rust/tree/v4.6.0/src/document_loaders
pub trait Loader: Send + Sync {
  fn load(self) -> Result<Vec<Document>, LoaderError>;
  fn load_and_split<TS: TextSplitter + 'static>(
    self,
    splitter: TS,
  ) -> Result<Vec<Document>, LoaderError>
  where
    Self: Sized,
  {
    let docs = self.load()?;
    Ok(splitter.split_documents(&docs)?)
  }
}

pub use docx::DocxLoader;
pub use error::{LoaderError, LoaderResult};
pub use html::HtmlLoader;
pub use pdf::PdfExtractLoader;
pub use source::{get_language_by_filename, LanguageParserOptions, SourceCodeLoader};
pub use text::TextLoader;
pub use url::Url;
