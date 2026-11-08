//! Host ABI only. Pitch analysis and tracking belong to the sibling DSP library.
use dsp_core::tuner::Tuner;

pub struct Engine {
    tuner: Tuner,
    input: [f32; 128],
    output: [f32; 6],
}

#[no_mangle]
pub extern "C" fn tuner_create(sample_rate: f32) -> *mut Engine {
    let Ok(tuner) = Tuner::new(sample_rate) else {
        return std::ptr::null_mut();
    };
    Box::into_raw(Box::new(Engine {
        tuner,
        input: [0.0; 128],
        output: [0.0; 6],
    }))
}

/// Caller must supply a live engine pointer returned by tuner_create.
#[no_mangle]
pub unsafe extern "C" fn tuner_destroy(engine: *mut Engine) {
    if !engine.is_null() {
        drop(Box::from_raw(engine));
    }
}
#[no_mangle]
pub unsafe extern "C" fn tuner_input(engine: *mut Engine) -> *mut f32 {
    (*engine).input.as_mut_ptr()
}
#[no_mangle]
pub unsafe extern "C" fn tuner_output(engine: *mut Engine) -> *const f32 {
    (*engine).output.as_ptr()
}
/// Process up to 128 mono PCM samples. Returns number of emitted observations.
#[no_mangle]
pub unsafe extern "C" fn tuner_process(engine: *mut Engine, count: usize) -> u32 {
    let e = &mut *engine;
    let mut emitted = 0;
    for i in 0..count.min(e.input.len()) {
        if let Some(r) = e.tuner.push(e.input[i]) {
            e.output = [
                r.hz,
                r.raw_hz,
                r.confidence,
                r.rms,
                if r.voiced { 1.0 } else { 0.0 },
                r.analysis_age_ms,
            ];
            emitted += 1;
        }
    }
    emitted
}
#[no_mangle]
pub unsafe extern "C" fn tuner_reset(engine: *mut Engine) {
    let e = &mut *engine;
    e.tuner.reset();
    e.output.fill(0.0);
}
