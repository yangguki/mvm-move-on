/** Returns a Korean conflict message when the program must not be deleted. */
export function programDeleteBlockedMessage(assignedStoreCount: number): string | null {
  if (assignedStoreCount > 0) {
    return "지점·TV에 지정된 프로그램은 삭제할 수 없어요. 먼저 지점의 프로그램 지정을 해제하세요.";
  }
  return null;
}
