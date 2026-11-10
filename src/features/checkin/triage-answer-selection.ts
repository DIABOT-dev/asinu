export function toggleTriageOption(selected: Set<string>, option: string, exclusive: string[]) {
  const next = new Set(selected);
  if (next.has(option)) {
    next.delete(option);
  } else if (exclusive.includes(option)) {
    return new Set([option]);
  } else {
    exclusive.forEach((item) => next.delete(item));
    next.add(option);
  }
  return next;
}

export function withoutExclusiveAnswers(selected: Set<string>, exclusive: string[]) {
  return new Set([...selected].filter((option) => !exclusive.includes(option)));
}

export function composeTriageAnswer(selected: Set<string>, custom: string, exclusive: string[]) {
  const text = custom.trim();
  const choices = text ? withoutExclusiveAnswers(selected, exclusive) : selected;
  const parts = [...choices, ...(text ? [text] : [])];
  return parts
    .filter(
      (value, index) =>
        parts.findIndex(
          (item) => item.trim().toLocaleLowerCase() === value.trim().toLocaleLowerCase(),
        ) === index,
    )
    .join(', ');
}
