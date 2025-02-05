mod document;
mod loader;
mod splitter;
mod types;

use loader::{
  get_language_by_filename, DocxLoader, HtmlLoader, LanguageParserOptions, Loader, LoaderError,
  PdfExtractLoader, SourceCodeLoader, TextLoader, Url,
};
use splitter::{MarkdownSplitter, TextSplitter, TextSplitterError, TokenSplitter};
use types::Document;

pub use document::{Chunk, Doc};
