import { isValidDate } from '../domain/dates';
import { MAX_AMOUNT } from '../domain/ledger';
import { isCategorySymbol, isTransactionType } from '../domain/validateLedger';
import { ApiError } from './client';

export function invalidRequest(message: string): never {
  throw new ApiError('INVALID_REQUEST', message);
}

export function requestFields(
  value: unknown,
  allowed: readonly string[],
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    Object.keys(value).some(key => !allowed.includes(key))
  ) {
    return invalidRequest('요청 데이터에 허용되지 않은 필드가 있습니다.');
  }
  return value as Record<string, unknown>;
}

export function requestId(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 191) {
    return invalidRequest('ID는 1~191자의 문자열이어야 합니다.');
  }
  return value;
}

export function resourcePath(collection: string, id: string): string {
  const validId = requestId(id);
  try {
    // URL의 경로 정규화로 다른 자원을 가리키는 ID는 전송하지 않습니다.
    if (validId === '.' || validId === '..') {
      throw new Error('Invalid path segment');
    }
    return `${collection}/${encodeURIComponent(validId)}`;
  } catch {
    return invalidRequest('요청할 ID의 형식을 확인해 주세요.');
  }
}

export function requestName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 20) {
    return invalidRequest('카테고리 이름은 1~20자로 입력해 주세요.');
  }
  return value.trim();
}

export function requestType(value: unknown) {
  if (!isTransactionType(value)) {
    return invalidRequest('거래 유형은 expense 또는 income이어야 합니다.');
  }
  return value;
}

export function requestSymbol(value: unknown) {
  if (!isCategorySymbol(value)) {
    return invalidRequest('카테고리 아이콘을 확인해 주세요.');
  }
  return value;
}

export function requestAmount(value: unknown): number {
  if (
    typeof value !== 'number' ||
    !Number.isSafeInteger(value) ||
    value < 1 ||
    value > MAX_AMOUNT
  ) {
    return invalidRequest('금액은 1~999,999,999,999원의 정수여야 합니다.');
  }
  return value;
}

export function requestDate(value: unknown): string {
  if (typeof value !== 'string' || !isValidDate(value)) {
    return invalidRequest('날짜는 실제 존재하는 YYYY-MM-DD 형식이어야 합니다.');
  }
  return value;
}

export function requestMemo(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length > 100) {
    return invalidRequest('메모는 100자 이하의 문자열이어야 합니다.');
  }
  return value.trim();
}
