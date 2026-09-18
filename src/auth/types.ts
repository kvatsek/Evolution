/** Информация о пользователе из CSV. */
export interface User {
  login: string;
  passwordHash: string;
  lastLogin: string;
  totalScore: number;
  level: number; // текущий уровень пользователя
}

/** Токен сессии. */
export interface Session {
  token: string;
  login: string;
  expiresAt: number;
}

/** Ответ API на регистрацию. */
export interface RegisterResponse {
  user: {
    login: string;
    totalScore: number;
    lastLogin: string;
    level?: number;
  };
}

/** Ответ API на вход. */
export interface LoginResponse {
  token: string;
  user: {
    login: string;
    totalScore: number;
    lastLogin: string;
    level?: number;
  };
}

/** Ответ API при сохранении счёта. */
export interface SaveScoreResponse {
  totalScore: number;
}

/** Ответ API на запрос информации о пользователе. */
export interface MeResponse {
  user: {
    login: string;
    totalScore: number;
    lastLogin: string;
    level?: number;
  };
}

/** Общий ответ API с ошибкой. */
export interface ErrorResponse {
  error: string;
}

/** Запись веса примера. */
export interface WeightEntry {
  expression: string;
  weight: number;
}

/** Ответ API на отправку ответа. */
export interface SubmitAnswerResponse {
  newWeights: WeightEntry[];
  level?: number; // текущий уровень пользователя (может измениться при переходе)
}
