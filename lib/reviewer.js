const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');

const client = new Anthropic();

/**
 * 학생 코드를 채점 기준에 따라 Claude가 리뷰한다.
 * @param {string} code - 학생 코드
 * @param {string} criteria - 채점 기준 텍스트
 * @param {boolean} compiled - 컴파일 성공 여부
 * @returns {{ criteriaScore: number, maxCriteriaScore: number, feedback: string, suggestions: string }}
 */
async function reviewCode(code, criteria, compiled) {
  const compilationNote = compiled
    ? '이 코드는 컴파일에 성공했습니다.'
    : '이 코드는 컴파일에 실패했습니다.';

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `당신은 C++ 과제를 채점하는 교수입니다.
학생의 코드를 주어진 채점 기준에 따라 평가하고, 건설적인 피드백을 제공합니다.
반드시 아래 JSON 형식으로만 응답하세요 (다른 텍스트 없이):
{
  "criteriaScore": <획득 점수 (숫자)>,
  "maxCriteriaScore": <만점 (숫자)>,
  "feedback": "<채점 근거 및 잘한 점 (한국어, 2-3문장)>",
  "suggestions": "<개선 제안 (한국어, 1-2문장)>"
}`,
    messages: [
      {
        role: 'user',
        content: `${compilationNote}

## 채점 기준
${criteria}

## 학생 코드
\`\`\`cpp
${code}
\`\`\`

위 채점 기준에 따라 코드를 평가해주세요.`,
      },
    ],
  });

  const raw = message.content[0].text.trim();

  try {
    // JSON 블록 파싱 (```json ... ``` 감싸인 경우 처리)
    const jsonMatch = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
    const jsonText = jsonMatch ? jsonMatch[1] : raw;
    return JSON.parse(jsonText);
  } catch {
    return {
      criteriaScore: 0,
      maxCriteriaScore: 0,
      feedback: `리뷰 파싱 오류: ${raw.slice(0, 200)}`,
      suggestions: '',
    };
  }
}

module.exports = { reviewCode };
