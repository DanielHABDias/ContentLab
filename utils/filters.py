def filter_segments(segments, min_words=8):
    return [
        s for s in segments
        if len(s["text"].split()) >= min_words
    ]
