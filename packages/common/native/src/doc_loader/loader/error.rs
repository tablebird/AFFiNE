use super::*;
use std::{io, string::FromUtf8Error};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum LoaderError {
  #[error("{0}")]
  TextSplitterError(#[from] TextSplitterError),

  #[error(transparent)]
  IOError(#[from] io::Error),

  #[error(transparent)]
  FromUtf8Error(#[from] FromUtf8Error),

  #[cfg(feature = "pdf-extract")]
  #[error(transparent)]
  PdfExtractError(#[from] pdf_extract::Error),

  #[cfg(feature = "pdf-extract")]
  #[error(transparent)]
  PdfExtractOutputError(#[from] pdf_extract::OutputError),

  #[error(transparent)]
  ReadabilityError(#[from] readability::error::Error),

  #[error("Error: {0}")]
  OtherError(String),
}
