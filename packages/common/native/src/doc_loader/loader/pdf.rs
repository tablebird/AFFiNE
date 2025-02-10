use pdf_extract::{output_doc, output_doc_encrypted, PlainTextOutput};
use std::thread::spawn;

/**
 * modified from https://github.com/Abraxas-365/langchain-rust/tree/v4.6.0/src/document_loaders
 */
use super::*;

#[derive(Debug, Clone)]
pub struct PdfExtractLoader {
  document: pdf_extract::Document,
}

impl PdfExtractLoader {
  pub fn new<R: Read>(reader: R) -> Result<Self, LoaderError> {
    let document = pdf_extract::Document::load_from(reader)
      .map_err(|e| LoaderError::OtherError(e.to_string()))?;
    Ok(Self { document })
  }
}

impl PdfExtractLoader {
  fn extract_text(&self) -> Result<String, LoaderError> {
    let mut doc = self.document.clone();
    // prevent panic in the parser thread from crashing the main thread
    match spawn(move || {
      let mut buffer: Vec<u8> = Vec::new();
      let mut output = PlainTextOutput::new(&mut buffer as &mut dyn std::io::Write);
      if doc.is_encrypted() {
        output_doc_encrypted(&mut doc, &mut output, "")?;
      } else {
        output_doc(&doc, &mut output)?;
      }
      Ok::<_, LoaderError>(buffer)
    })
    .join()
    {
      Ok(buffer) => return Ok(String::from_utf8(buffer?)?),
      Err(e) => {
        return Err(LoaderError::UnsupportedPDFFormat(
          e.downcast::<String>()
            .map(|s| s.to_string())
            .unwrap_or("parser thread panic".to_string()),
        ))
      }
    }
  }

  fn extract_text_to_doc(&self) -> Result<Document, LoaderError> {
    let text = self.extract_text()?;
    Ok(Document::new(text))
  }
}

impl Loader for PdfExtractLoader {
  fn load(self) -> Result<Vec<Document>, LoaderError> {
    let doc = self.extract_text_to_doc()?;
    Ok(vec![doc])
  }
}

#[cfg(test)]
mod tests {
  use std::{fs::read, io::Cursor, path::PathBuf};

  use super::*;

  #[test]
  fn test_parse_pdf() {
    let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("fixtures");
    let buffer = read(fixtures.join("sample.pdf")).unwrap();

    let reader = Cursor::new(buffer);
    let loader = PdfExtractLoader::new(reader).expect("Failed to create PdfExtractLoader");

    let docs = loader.load().unwrap();

    assert_eq!(docs.len(), 1);
    assert_eq!(
      &docs[0].page_content[..100],
      "\n\nSample PDF\nThis is a simple PDF ﬁle. Fun fun fun.\n\nLorem ipsum dolor  sit amet,  \
       consectetuer  a"
    );
  }
}
