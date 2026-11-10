"""Offline Hindi TTS through the espeak-ng library bundled in the espeakng_loader wheel.
synth(text, voice, rate, pitch, range) -> (float32 mono @22050, [(word_start_s, word_text)])"""
import ctypes as C
import numpy as np
import espeakng_loader as EL

lib = C.CDLL(EL.get_library_path())


class EVENT(C.Structure):
    _fields_ = [("type", C.c_int), ("unique_identifier", C.c_uint), ("text_position", C.c_int), ("length", C.c_int),
                ("audio_position", C.c_int), ("sample", C.c_int), ("user_data", C.c_void_p), ("id", C.c_char * 8)]


CB = C.CFUNCTYPE(C.c_int, C.POINTER(C.c_short), C.c_int, C.POINTER(EVENT))
SR = lib.espeak_Initialize(1, 200, EL.get_data_path().encode(), 0x8000)  # AUDIO_OUTPUT_RETRIEVAL
_buf: list = []
_ev: list = []


@CB
def _cb(wav, n, ev):
    if n > 0:
        _buf.append(np.ctypeslib.as_array(wav, shape=(n,)).copy())
    i = 0
    while ev[i].type != 0:
        if ev[i].type == 1:  # word
            _ev.append((ev[i].audio_position / 1000.0, ev[i].text_position, ev[i].length))
        i += 1
    return 0


lib.espeak_SetSynthCallback(_cb)


def synth(text: str, voice="hi", rate=150, pitch=50, rng=50, wordgap=0):
    _buf.clear(); _ev.clear()
    lib.espeak_SetVoiceByName(voice.encode())
    for k, v in ((1, rate), (3, pitch), (4, rng), (7, wordgap), (2, 100)):
        lib.espeak_SetParameter(k, v, 0)
    b = text.encode("utf-8")
    lib.espeak_Synth(b, len(b) + 1, 0, 1, 0, 1, None, None)  # POS_CHARACTER, espeakCHARS_UTF8
    lib.espeak_Synchronize()
    audio = (np.concatenate(_buf).astype(np.float32) / 32768.0) if _buf else np.zeros(1, np.float32)
    chars = list(text)
    words = []
    for t, pos, ln in _ev:
        words.append((t, "".join(chars[pos - 1: pos - 1 + ln])))
    return audio, words
