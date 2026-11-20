export function storeProgramAssignBlockedMessage(publishedVersion: number | null): string | null {
  if (publishedVersion == null) {
    return "게시된 버전이 있는 프로그램만 지정할 수 있어요";
  }
  return null;
}