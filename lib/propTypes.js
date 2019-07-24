export function minW(props, propName) {
  const value = props[propName];
  if (typeof value !== "number") return new Error("minWidth not Number");
  if (value > props.w || value > props.maxW)
    return new Error("minWidth larger than item width/maxWidth");
}

export function maxW(props, propName) {
  const value = props[propName];
  if (typeof value !== "number") return new Error("maxWidth not Number");
  if (value < props.w || value < props.minW)
    return new Error("maxWidth smaller than item width/minWidth");
}

export function minH(props, propName) {
  const value = props[propName];
  if (typeof value !== "number") return new Error("minHeight not Number");
  if (value > props.h || value > props.maxH)
    return new Error("minHeight larger than item height/maxHeight");
}

export function maxH(props, propName) {
  const value = props[propName];
  if (typeof value !== "number") return new Error("maxHeight not Number");
  if (value < props.h || value < props.minH)
    return new Error("maxHeight smaller than item height/minHeight");
}
