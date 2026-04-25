import type { Lang } from "../config";

export interface CommonStrings {
  switchLanguage: string;
  language: string;
  close: string;
  countdown: {
    days: string;
    hours: string;
    min: string;
    sec: string;
    // Grid-style longer labels
    daysLong: string;
    hoursLong: string;
    minutesLong: string;
    secondsLong: string;
  };
  widgetErrorBoundary: {
    somethingWentWrong: string;
    widgetEncounteredError: string;
    retry: string;
  };
  loadingState: {
    backgroundAlt: string;
    loading: string;
    mayTakeFewSeconds: string;
    unableToLoad: string;
    tryAgain: string;
  };
}

const en: CommonStrings = {
  switchLanguage: "Change language",
  language: "Language",
  close: "Close",
  countdown: {
    days: "Days",
    hours: "Hours",
    min: "Min",
    sec: "Sec",
    daysLong: "Days",
    hoursLong: "Hours",
    minutesLong: "Minutes",
    secondsLong: "Seconds",
  },
  widgetErrorBoundary: {
    somethingWentWrong: "Something went wrong",
    widgetEncounteredError: "This widget encountered an error",
    retry: "Retry",
  },
  loadingState: {
    backgroundAlt: "Background",
    loading: "Loading...",
    mayTakeFewSeconds: "This may take a few seconds.",
    unableToLoad: "Unable to Load Data",
    tryAgain: "Try Again",
  },
};

const ko: CommonStrings = {
  switchLanguage: "언어 변경",
  language: "언어",
  close: "닫기",
  countdown: {
    days: "일",
    hours: "시간",
    min: "분",
    sec: "초",
    daysLong: "일",
    hoursLong: "시간",
    minutesLong: "분",
    secondsLong: "초",
  },
  widgetErrorBoundary: {
    somethingWentWrong: "문제가 발생했습니다",
    widgetEncounteredError: "이 위젯에서 오류가 발생했습니다",
    retry: "재시도",
  },
  loadingState: {
    backgroundAlt: "배경",
    loading: "로딩 중...",
    mayTakeFewSeconds: "몇 초가 걸릴 수 있습니다.",
    unableToLoad: "데이터를 불러올 수 없습니다",
    tryAgain: "다시 시도",
  },
};

export const commonTranslations: Record<Lang, CommonStrings> = {
  en,
  ko,
};
