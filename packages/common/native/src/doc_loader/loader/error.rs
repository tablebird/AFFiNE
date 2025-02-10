use std::{io, str::Utf8Error, string::FromUtf8Error};

use thiserror::Error;

/**
 * modified from https://github.com/Abraxas-365/langchain-rust/tree/v4.6.0/src/document_loaders
 */
use super::*;

#[derive(Error, Debug)]
pub enum LoaderError {
  #[error("{0}")]
  TextSplitterError(#[from] TextSplitterError),

  #[error(transparent)]
  IOError(#[from] io::Error),

  #[error(transparent)]
  Utf8Error(#[from] Utf8Error),

  #[error(transparent)]
  FromUtf8Error(#[from] FromUtf8Error),

  #[cfg(feature = "pdf-extract")]
  #[error(transparent)]
  PdfExtractError(#[from] pdf_extract::Error),

  #[cfg(feature = "pdf-extract")]
  #[error(transparent)]
  PdfExtractOutputError(#[from] pdf_extract::OutputError),

  #[error("Unsupported PDF format: {0}")]
  UnsupportedPDFFormat(String),

  #[error(transparent)]
  ReadabilityError(#[from] readability::error::Error),

  #[error("Unsupported source language")]
  UnsupportedLanguage,

  #[error("Error: {0}")]
  OtherError(String),
}

pub type LoaderResult<T> = Result<T, LoaderError>;
