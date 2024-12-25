use napi::{Error, Result, Status};
use rubato::Resampler;

const WHISPER_SAMPLE_RATE: f64 = 16000.0;

pub fn resample(sample_rate: f64, number_channels: u32, samples: &[f32]) -> Result<Vec<f32>> {
  if sample_rate != WHISPER_SAMPLE_RATE {
    // Calculate parameters for resampling
    let params = rubato::SincInterpolationParameters {
      sinc_len: 256,
      f_cutoff: 0.95,
      interpolation: rubato::SincInterpolationType::Linear,
      oversampling_factor: 256,
      window: rubato::WindowFunction::BlackmanHarris2,
    };

    let mut resampler = rubato::SincFixedIn::<f32>::new(
      WHISPER_SAMPLE_RATE / sample_rate,
      2.0,
      params,
      samples.len() / number_channels as usize,
      number_channels as usize,
    )
    .map_err(|e| Error::from_reason(format!("Failed to create resampler: {}", e)))?;

    // Transpose the interleaved samples into a vec of channel vecs
    let mut channel_vecs = vec![Vec::new(); number_channels as usize];
    for chunk in samples.chunks(number_channels as usize) {
      for (i, &sample) in chunk.iter().enumerate() {
        channel_vecs[i].push(sample);
      }
    }

    let mut waves_out = resampler
      .process(&channel_vecs, None)
      .map_err(|e| Error::from_reason(format!("Failed to run resampler: {}", e)))?;

    Ok(waves_out.pop().ok_or(Error::new(
      Status::GenericFailure,
      "No resampled output found",
    ))?)
  } else {
    // Convert to mono without resampling
    let mono_samples: Vec<f32> = samples
      .chunks(number_channels as usize)
      .map(|chunk| chunk.iter().sum::<f32>() / number_channels as f32)
      .collect();

    Ok(mono_samples)
  }
}
