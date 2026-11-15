import { env } from '../config/env';

export const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiErrorCode =
  | 'CONFIGURATION'
  | 'HTTP'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'INVALID_RESPONSE';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiClientOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

function requestUrl(baseUrl: string | undefined, path: string): string {
  try {
    const url = new URL(baseUrl ?? '');
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      /[\s\\]/.test(baseUrl ?? '') ||
      !path.startsWith('/') ||
      path.startsWith('//') ||
      /[\s\\#]/.test(path)
    ) {
      throw new Error('Invalid API URL');
    }
    return `${baseUrl?.replace(/\/+$/, '')}${path}`;
  } catch {
    throw new ApiError(
      'CONFIGURATION',
      '서버 연결 주소가 올바르지 않습니다. 앱 설정을 확인해 주세요.',
    );
  }
}

function httpMessage(status: number): string {
  if (status === 404) {
    return '요청한 데이터를 찾을 수 없습니다.';
  }
  if (status === 429) {
    return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  }
  if (status === 409) {
    return '현재 데이터와 충돌하여 처리하지 못했습니다. 최신 데이터를 확인한 뒤 다시 시도해 주세요.';
  }
  if (status >= 500) {
    return '서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해 주세요.';
  }
  return '서버 요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

function invalidResponse(status: number): ApiError {
  return new ApiError(
    'INVALID_RESPONSE',
    '서버에서 받은 데이터 형식을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.',
    status,
  );
}

async function readJson<T>(
  response: Response,
  validate: (value: unknown) => T,
): Promise<T> {
  if (response.status === 204) {
    throw invalidResponse(response.status);
  }
  // 본문 수신 실패는 네트워크 오류, JSON/도메인 형식 오류는 응답 오류입니다.
  const body = await response.text();
  try {
    const value: unknown = JSON.parse(body);
    return validate(value);
  } catch {
    throw invalidResponse(response.status);
  }
}

export function createApiClient({
  baseUrl = env.apiBaseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: ApiClientOptions = {}) {
  // 설정은 요청 시 검증하므로 API 설정 누락이 로컬 앱 실행을 막지 않습니다.
  async function send<T>(
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    read: (response: Response) => Promise<T>,
    body?: object,
  ): Promise<T> {
    const url = requestUrl(baseUrl?.trim(), path);
    if (
      !Number.isFinite(timeoutMs) ||
      timeoutMs <= 0 ||
      timeoutMs > 2_147_483_647
    ) {
      throw new ApiError(
        'CONFIGURATION',
        '서버 연결 대기 시간 설정을 확인해 주세요.',
      );
    }

    let json: string | undefined;
    if (body !== undefined) {
      try {
        json = JSON.stringify(body);
      } catch {
        throw new ApiError(
          'INVALID_REQUEST',
          '전송할 데이터 형식을 확인해 주세요.',
        );
      }
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new ApiError(
            'TIMEOUT',
            '서버 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
          ),
        );
        controller.abort();
      }, timeoutMs);
    });
    const request = async () => {
      const response = await fetch(url, {
        method,
        headers: {
          Accept: 'application/json',
          ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(json !== undefined ? { body: json } : {}),
        credentials: 'omit',
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new ApiError(
          'HTTP',
          httpMessage(response.status),
          response.status,
        );
      }

      return read(response);
    };

    try {
      // fetch가 취소에 응답하지 않아도 본문 수신까지 대기 시간을 제한합니다.
      return await Promise.race([request(), timeout]);
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        'NETWORK',
        '서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    get<T>(path: string, validate: (value: unknown) => T): Promise<T> {
      return send('GET', path, response => readJson(response, validate));
    },
    post<T>(
      path: string,
      body: object,
      validate: (value: unknown) => T,
    ): Promise<T> {
      return send('POST', path, response => readJson(response, validate), body);
    },
    patch<T>(
      path: string,
      body: object,
      validate: (value: unknown) => T,
    ): Promise<T> {
      return send(
        'PATCH',
        path,
        response => readJson(response, validate),
        body,
      );
    },
    delete(path: string): Promise<void> {
      return send('DELETE', path, async response => {
        if (response.status !== 204) {
          throw invalidResponse(response.status);
        }
      });
    },
  };
}

export const apiClient = createApiClient();
