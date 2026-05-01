// 첨삭 결과(first) vs 컨설턴트 최종본(final) 비교 메트릭.
// edit_ratio: 정규화 후 글자 단위 Levenshtein distance / max(len) — 0(동일) ~ 1(완전 다름)
// edit_binary: 정규화 후 차이가 0이면 0(untouched), 그 외 1(edited)

// 공백·구두점·줄바꿈을 무시한 정규화.
// 의미 없는 마침표 정리, 띄어쓰기 변경, 줄바꿈 추가 등은 "손 안 댐"으로 취급.
function normalize(text: string): string {
  return text
    .replace(/\s+/g, '')                    // 모든 화이트스페이스 제거
    .replace(/[.,;:!?'"`~()\[\]{}<>\-—–·•]/g, '')  // 일반 구두점 제거
    .replace(/[​-‏﻿]/g, '')  // zero-width 문자 제거
    .toLowerCase();
}

// 글자 단위 Levenshtein distance.
// 한국어는 글자 = 의미 단위에 가까워서 토크나이저 없이 사용 가능.
// 메모리 절약: 두 줄짜리 DP 테이블만 유지.
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const m = a.length;
  const n = b.length;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,        // 삽입
        prev[j] + 1,            // 삭제
        prev[j - 1] + cost      // 교체
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

export interface DiffMetrics {
  editRatio: number;   // 0.0 ~ 1.0
  editBinary: 0 | 1;
}

export function computeDiffMetrics(first: string, final: string): DiffMetrics {
  const normFirst = normalize(first);
  const normFinal = normalize(final);

  if (normFirst === normFinal) {
    return { editRatio: 0, editBinary: 0 };
  }

  const distance = levenshtein(normFirst, normFinal);
  const denominator = Math.max(normFirst.length, normFinal.length);
  const editRatio = denominator === 0 ? 0 : distance / denominator;

  return {
    editRatio: Math.min(1, Math.max(0, editRatio)),
    editBinary: 1,
  };
}
