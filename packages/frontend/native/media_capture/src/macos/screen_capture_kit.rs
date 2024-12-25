use std::{
  collections::HashMap,
  ffi::c_void,
  ptr,
  sync::{
    atomic::{AtomicPtr, Ordering},
    Arc, LazyLock, RwLock,
  },
};

use block2::{Block, RcBlock};
use core_foundation::{
  base::TCFType,
  string::{CFString, CFStringRef},
};
use coreaudio::sys::{
  kAudioHardwarePropertyProcessObjectList, kAudioObjectPropertyElementMain,
  kAudioObjectPropertyScopeGlobal, kAudioObjectSystemObject, kAudioProcessPropertyBundleID,
  kAudioProcessPropertyIsRunning, kAudioProcessPropertyPID, AudioObjectAddPropertyListenerBlock,
  AudioObjectID, AudioObjectPropertyAddress, AudioObjectRemovePropertyListenerBlock,
};
use napi::{
  bindgen_prelude::{Error, Float32Array, Result, Status},
  threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode},
};
use napi_derive::napi;
use screencapturekit::shareable_content::SCShareableContent;
use uuid::Uuid;

use crate::{
  error::CoreAudioError,
  pid::{audio_process_list, get_process_property},
  tap_audio::{AggregateDevice, AudioTapStream},
};

static RUNNING_APPLICATIONS: LazyLock<RwLock<Vec<AudioObjectID>>> =
  LazyLock::new(|| RwLock::new(audio_process_list().expect("Failed to get running applications")));

static APPLICATION_STATE_CHANGED_SUBSCRIBERS: LazyLock<
  RwLock<HashMap<AudioObjectID, HashMap<Uuid, Arc<ThreadsafeFunction<(), ()>>>>>,
> = LazyLock::new(|| RwLock::new(HashMap::new()));

static APPLICATION_STATE_CHANGED_LISTENER_BLOCKS: LazyLock<
  RwLock<HashMap<AudioObjectID, AtomicPtr<c_void>>>,
> = LazyLock::new(|| RwLock::new(HashMap::new()));

struct TappableApplication {
  object_id: AudioObjectID,
}

impl TappableApplication {
  fn new(object_id: AudioObjectID) -> Self {
    Self { object_id }
  }

  fn process_id(&self) -> std::result::Result<i32, CoreAudioError> {
    get_process_property(&self.object_id, kAudioProcessPropertyPID)
  }

  fn bundle_identifier(&self) -> Result<String> {
    let bundle_id: CFStringRef =
      get_process_property(&self.object_id, kAudioProcessPropertyBundleID)?;
    Ok(unsafe { CFString::wrap_under_get_rule(bundle_id) }.to_string())
  }
}

#[napi]
pub struct Application {
  inner: TappableApplication,
  pub(crate) object_id: AudioObjectID,
}

#[napi]
impl Application {
  fn new(app: TappableApplication) -> Result<Self> {
    let object_id = app.object_id;

    Ok(Self {
      inner: app,
      object_id,
    })
  }

  #[napi]
  pub fn tap_global_audio(
    excluded_processes: Option<Vec<&Application>>,
    audio_stream_callback: Arc<ThreadsafeFunction<Float32Array, (), Float32Array, true>>,
  ) -> Result<AudioTapStream> {
    let mut device = AggregateDevice::create_global_tap_but_exclude_processes(
      &excluded_processes
        .unwrap_or_default()
        .iter()
        .map(|app| app.object_id)
        .collect::<Vec<_>>(),
    )?;
    device.start(audio_stream_callback)
  }

  #[napi]
  pub fn process_id(&self) -> Result<i32> {
    Ok(self.inner.process_id()?)
  }

  #[napi]
  pub fn bundle_identifier(&self) -> Result<String> {
    Ok(self.inner.bundle_identifier()?)
  }

  #[napi(getter)]
  pub fn get_is_running(&self) -> Result<bool> {
    Ok(get_process_property(
      &self.object_id,
      kAudioProcessPropertyIsRunning,
    )?)
  }

  #[napi]
  pub fn tap_audio(
    &self,
    audio_stream_callback: Arc<ThreadsafeFunction<Float32Array, (), Float32Array, true>>,
  ) -> Result<AudioTapStream> {
    let mut device = AggregateDevice::new(&self)?;
    device.start(audio_stream_callback)
  }
}

#[napi]
pub struct ApplicationListChangedSubscriber {
  listener_block: *const Block<dyn Fn(u32, *mut c_void) -> ()>,
}

#[napi]
impl ApplicationListChangedSubscriber {
  #[napi]
  pub fn unsubscribe(&self) -> Result<()> {
    let status = unsafe {
      AudioObjectRemovePropertyListenerBlock(
        kAudioObjectSystemObject,
        &AudioObjectPropertyAddress {
          mSelector: kAudioHardwarePropertyProcessObjectList,
          mScope: kAudioObjectPropertyScopeGlobal,
          mElement: kAudioObjectPropertyElementMain,
        },
        ptr::null_mut(),
        self.listener_block.cast_mut().cast(),
      )
    };
    if status != 0 {
      return Err(Error::new(
        Status::GenericFailure,
        "Failed to remove property listener",
      ));
    }
    Ok(())
  }
}

#[napi]
pub struct ApplicationStateChangedSubscriber {
  id: Uuid,
  object_id: AudioObjectID,
}

#[napi]
impl ApplicationStateChangedSubscriber {
  #[napi]
  pub fn unsubscribe(&self) {
    if let Ok(mut lock) = APPLICATION_STATE_CHANGED_SUBSCRIBERS.write() {
      if let Some(subscribers) = lock.get_mut(&self.object_id) {
        subscribers.remove(&self.id);
        if subscribers.is_empty() {
          lock.remove(&self.object_id);
          if let Some(listener_block) = APPLICATION_STATE_CHANGED_LISTENER_BLOCKS
            .write()
            .ok()
            .as_mut()
            .and_then(|map| map.remove(&self.object_id))
          {
            unsafe {
              AudioObjectRemovePropertyListenerBlock(
                self.object_id,
                &AudioObjectPropertyAddress {
                  mSelector: kAudioProcessPropertyIsRunning,
                  mScope: kAudioObjectPropertyScopeGlobal,
                  mElement: kAudioObjectPropertyElementMain,
                },
                ptr::null_mut(),
                listener_block.load(Ordering::Relaxed),
              );
            }
          }
        }
      }
    }
  }
}

#[napi]
pub struct ShareableContent {
  _inner: SCShareableContent,
}

#[napi]
impl ShareableContent {
  #[napi]
  pub fn on_application_list_changed(
    callback: Arc<ThreadsafeFunction<(), ()>>,
  ) -> Result<ApplicationListChangedSubscriber> {
    let callback_block: RcBlock<dyn Fn(u32, *mut c_void) -> ()> =
      RcBlock::new(move |_in_number_addresses, _in_addresses: *mut c_void| {
        if let Err(err) = RUNNING_APPLICATIONS
          .write()
          .map_err(|_| {
            Error::new(
              Status::GenericFailure,
              "Poisoned RwLock while writing RunningApplications",
            )
          })
          .and_then(|mut running_applications| {
            audio_process_list().map_err(From::from).map(|apps| {
              *running_applications = apps;
            })
          })
        {
          callback.call(Err(err), ThreadsafeFunctionCallMode::NonBlocking);
        } else {
          callback.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
        }
      });
    let listener_block = &*callback_block as *const Block<dyn Fn(u32, *mut c_void) -> ()>;
    let status = unsafe {
      AudioObjectAddPropertyListenerBlock(
        kAudioObjectSystemObject,
        &AudioObjectPropertyAddress {
          mSelector: kAudioHardwarePropertyProcessObjectList,
          mScope: kAudioObjectPropertyScopeGlobal,
          mElement: kAudioObjectPropertyElementMain,
        },
        ptr::null_mut(),
        listener_block.cast_mut().cast(),
      )
    };
    if status != 0 {
      return Err(Error::new(
        Status::GenericFailure,
        "Failed to add property listener",
      ));
    }
    Ok(ApplicationListChangedSubscriber { listener_block })
  }

  #[napi]
  pub fn on_app_state_changed(
    app: &Application,
    callback: Arc<ThreadsafeFunction<(), ()>>,
  ) -> Result<ApplicationStateChangedSubscriber> {
    let id = Uuid::new_v4();
    let mut lock = APPLICATION_STATE_CHANGED_SUBSCRIBERS.write().map_err(|_| {
      Error::new(
        Status::GenericFailure,
        "Poisoned RwLock while writing ApplicationStateChangedSubscribers",
      )
    })?;
    if let Some(subscribers) = lock.get_mut(&app.object_id) {
      subscribers.insert(id, callback);
    } else {
      let object_id = app.object_id;
      let list_change: RcBlock<dyn Fn(u32, *mut c_void) -> ()> =
        RcBlock::new(move |in_number_addresses, in_addresses: *mut c_void| {
          let addresses = unsafe {
            std::slice::from_raw_parts(
              in_addresses as *mut AudioObjectPropertyAddress,
              in_number_addresses as usize,
            )
          };
          for address in addresses {
            if address.mSelector == kAudioProcessPropertyIsRunning {
              if let Some(subscribers) = APPLICATION_STATE_CHANGED_SUBSCRIBERS
                .read()
                .ok()
                .as_ref()
                .and_then(|map| map.get(&object_id))
              {
                for callback in subscribers.values() {
                  callback.call(Ok(()), ThreadsafeFunctionCallMode::NonBlocking);
                }
              }
            }
          }
        });
      let address = AudioObjectPropertyAddress {
        mSelector: kAudioProcessPropertyIsRunning,
        mScope: kAudioObjectPropertyScopeGlobal,
        mElement: kAudioObjectPropertyElementMain,
      };
      let listener_block = &*list_change as *const Block<dyn Fn(u32, *mut c_void) -> ()>;
      let status = unsafe {
        AudioObjectAddPropertyListenerBlock(
          app.object_id,
          &address,
          ptr::null_mut(),
          listener_block.cast_mut().cast(),
        )
      };
      if status != 0 {
        return Err(Error::new(
          Status::GenericFailure,
          "Failed to add property listener",
        ));
      }
      let subscribers = {
        let mut map = HashMap::new();
        map.insert(id, callback);
        map
      };
      lock.insert(app.object_id, subscribers);
    }
    Ok(ApplicationStateChangedSubscriber {
      id,
      object_id: app.object_id,
    })
  }

  #[napi(constructor)]
  pub fn new() -> Result<Self> {
    Ok(Self {
      _inner: SCShareableContent::get().map_err(|err| Error::new(Status::GenericFailure, err))?,
    })
  }

  #[napi]
  pub fn applications(&self) -> Result<Vec<Application>> {
    RUNNING_APPLICATIONS
      .read()
      .map_err(|_| {
        Error::new(
          Status::GenericFailure,
          "Poisoned RwLock while reading RunningApplications",
        )
      })?
      .iter()
      .filter_map(|id| {
        let app = TappableApplication::new(*id);
        if !app.bundle_identifier().ok()?.is_empty() {
          Some(Application::new(app))
        } else {
          None
        }
      })
      .collect()
  }
}
