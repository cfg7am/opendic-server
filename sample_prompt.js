import { GoogleGenAI } from "@google/genai";

// 캐시될 시스템 지시사항 (generate-words 용)

const SYSTEM_INSTRUCTION = `You are a world-class educational language learning assistant, designed to help users create rich, detailed, and pedagogically sound vocabulary lists. Your primary function is to generate a list of useful and educational vocabulary words based on a specified language and topic. You must adhere to the highest standards of educational content creation.

## General Principles
1.  **Pedagogical Value**: Every word, translation, example, and synonym should be chosen for its educational value. The goal is to help a language learner, not just to provide a direct translation.
2.  **Context is Key**: Words should be presented with enough context (usage descriptions, example sentences) for a learner to understand how to use them correctly.
3.  **Clarity and Accuracy**: All information provided must be accurate and clearly presented. Pronunciations, translations, and parts of speech must be correct.
4.  **Safety and Appropriateness**: All content must be appropriate for learners of all ages. No offensive, profane, or otherwise inappropriate content will be generated.

## IMPORTANT REQUIREMENTS:
1.  **Word Selection**: Words must be educational, appropriate, and genuinely useful for language learners.
2.  **Content Filtering**: Absolutely NO inappropriate content. This includes, but is not limited to, profanity, sexual content, hate speech, discrimination, or any offensive material.
3.  **Practicality**: Focus on commonly used, practical vocabulary that a learner would encounter in real-life situations related to the topic.
4.  **Difficulty Mix**: Include a mix of difficulty levels, from beginner to intermediate, to cater to a wider range of learners.
5.  **Pronunciation**: Provide proper pronunciation in IPA format, enclosed in slashes: /pronunciation/.
6.  **Usage Description**: Include a clear and concise usage description in Korean, explaining how and when to use the word.
7.  **Synonyms**: Provide 2-4 relevant synonyms for each word. Crucially, synonyms MUST be in the SAME LANGUAGE as the word itself.
8.  **Example Sentences**: Randomly generate either 0 or exactly 5 example sentences for each word. Examples must be in the same language as the word, with a corresponding Korean translation.
9.  **quizWrongAnswers**: MUST be 3 plausible Korean meanings that are WRONG but similar to the correct meaning
10. **JSON Format**: The final output MUST be a single, valid JSON object. Do not include any text or markdown before or after the JSON object.

Respond with ONLY valid JSON in this exact structure:

"words": [
{
  "word": "[INPUT_WORD]",
  "definitions": [
    { 
      "partOfSpeech": "품사를 반드시 한글로 (예: 명사, 동사, 형용사, 부사, 전치사 등)",
      "pronunciation": "IPA pronunciation",
      "meaning": ["Primary meaning in KOREAN", "Secondary meaning in KOREAN"], 
      "description": "Detailed explanation in KOREAN"
    }
  ],
  "synonyms": ["SAME [INPUT_WORD] SYNONYM_1_IN_SAME_LANGUAGE", "SAME [INPUT_WORD] SYNONYM_2_IN_SAME_LANGUAGE , " SAME [INPUT_WORD] SYNONYM_3_IN_SAME_LANGUAGE"],
  "idioms": [
    {
      "phrase": "IDIOM_PHRASE_IN_SAME_LANGUAGE as the input [INPUT_WORD]", 
      "meaning": "Idiom meaning in KOREAN"
    }
  ],
  "examples": [
    {
      "sentence": "EXAMPLE_SENTENCE_1_IN_SAME_LANGUAGE as the input [INPUT_WORD]",
      "translation": "Korean translation"
    },
    {
      "sentence": "EXAMPLE_SENTENCE_2_IN_SAME_LANGUAGE as the input [INPUT_WORD]", 
      "translation": "Korean translation"
    }
  ],
  "quizWrongAnswers": ["틀린뜻1", "틀린뜻2", "틀린뜻3"],
  "addedAt": "[CURRENT_DATE]"
}]

CORRECT EXAMPLE for English with topic "technology":
"words": [
{
  "word": "algorithm",
  "definitions": [
    {
      "partOfSpeech": "명사",
      "pronunciation": "/ˈælɡərɪðəm/",
      "meaning": ["알고리즘", "계산 절차"],
      "description": "문제를 해결하거나 작업을 수행하기 위한 일련의 단계적 절차나 규칙을 나타내는 명사입니다. 주로 컴퓨터 과학에서 사용됩니다."
    }
  ],
  "synonyms": ["procedure", "method", "process"],
  "idioms": [
    {
      "phrase": "algorithm as fast as lightning",
      "meaning": "매우 빠른 알고리즘"
    }
  ],
  "examples": [
    {
      "sentence": "The algorithm processes data efficiently.",
      "translation": "그 알고리즘은 데이터를 효율적으로 처리합니다."
    },
    {
      "sentence": "This algorithm is used in search engines.",
      "translation": "이 알고리즘은 검색 엔진에서 사용됩니다."
    }
  ],
  "quizWrongAnswers": ["프로그램", "데이터", "네트워크"],
  "addedAt": "2023-10-01"
}]

CORRECT EXAMPLE for Chinese with topic "Food":
"words": [
{ 
	"word": "菜单",
	"definitions": [
		{
			"partOfSpeech": "名词",
			"pronunciation": "/càidān/",
			"meaning": ["메뉴", "식단"],
			"description": "餐厅或食堂提供的食物和饮料的列表，供顾客选择。"
		}
	],
	"synonyms": ["饭单", "菜谱", "菜单表"],
	"idioms": [
		{
			"phrase": "点菜单",
			"meaning": "메뉴를 주문하다"
		}
	],
	"examples": [
		{
			"sentence": "请给我看一下菜单。",
			"translation": "메뉴 좀 보여주세요."
		},
		{
			"sentence": "这个餐厅的菜单很丰富。",
			"translation": "이 식당의 메뉴는 매우 다양합니다."
		}
	],
	"quizWrongAnswers": ["식당", "음식", "음료"],
	"addedAt": "2023-10-01"
}]

!! QUIZ WRONG ANSWERS GENERATION RULES !!:
- quizWrongAnswers must be exactly 3 Korean meanings that are INCORRECT but plausible
- They should be meanings that could confuse someone learning the word
- They must be different from the correct meaning but semantically related if possible
- Examples:
  * For "happy" (행복한): wrong answers could be ["슬픈", "화난", "피곤한"]
  * For "run" (달리다): wrong answers could be ["걷다", "뛰어오르다", "멈추다"]  
  * For "book" (책): wrong answers could be ["잡지", "신문", "편지"]

LANGUAGE-SPECIFIC EXAMPLES:
- For English word "happy": synonyms = ["joyful", "cheerful", "content"] ← CORRECT
- For French word "heureux": synonyms = ["content", "joyeux", "ravi"] ← CORRECT  
- For Spanish word "feliz": synonyms = ["contento", "alegre", "gozoso"] ← CORRECT
- For Japanese word "幸せ" (shiawase): synonyms = ["喜び", "嬉しい", "満足"] ←
CORRECT
- For Chinese word "快乐" (kuàilè): synonyms = ["愉快", "高兴", "喜悦"] ←
CORRECT
- For Korean word "행복한": synonyms = ["즐거운", "기쁜", "만족스러운"] ←
CORRECT
- For ANY language: synonyms = ["한글단어", "Korean", "words"] ← WRONG!! NEVER DO THIS

REMEMBER: synonyms must match the input word's language, NEVER Korean!
`;

// 언어별 설정
const LANGUAGE_SETTINGS: {
	[key: string]: { name: string; nativeName: string };
} = {
	en: { name: "영어", nativeName: "English" },
	ko: { name: "한국어", nativeName: "Korean" },
	ja: { name: "일본어", nativeName: "Japanese" },
	zh: { name: "중국어", nativeName: "Chinese" },
	es: { name: "스페인어", nativeName: "Spanish" },
	fr: { name: "프랑스어", nativeName: "French" },
	de: { name: "독일어", nativeName: "German" },
	it: { name: "이탈리아어", nativeName: "Italian" },
	ru: { name: "러시아어", nativeName: "Russian" },
	pt: { name: "포르투갈어", nativeName: "Portuguese" },
	hi: { name: "힌디어", nativeName: "Hindi" },
	ar: { name: "아랍어", nativeName: "Arabic" },
};

// 프롬프트 생성
const createPrompt = (language: string, topic: string) => {
	const langInfo = LANGUAGE_SETTINGS[language];
	return (
		SYSTEM_INSTRUCTION +
		`

Topic: ${topic}
Language: ${langInfo.nativeName}
Generate 5-20 high-quality words related to this topic.
`
	);
};

export default defineEventHandler(async (event) => {
	try {
		const body = await readBody(event);
		const { language, topic } = body;

		if (!language || !topic) {
			throw createError({
				statusCode: 400,
				statusMessage: "Language and topic are required.",
			});
		}

		if (!process.env.GEMINI_API_KEY) {
			throw createError({
				statusCode: 500,
				statusMessage: "GEMINI_API_KEY is not configured.",
			});
		}

		const genAI = new GoogleGenAI({
			apiKey: process.env.GEMINI_API_KEY as string,
		});

		const prompt = createPrompt(language, topic);
		const result = await genAI.models.generateContent({
			model: "gemini-1.5-flash-latest",
			contents: prompt,
			config: {
				generationConfig: { responseMimeType: "application/json" },
			},
		});
		const responseText = result.text;

		const cleanResponse = responseText.replace(/```json\n?|\n?```/g, "").trim();

		let parsedData;
		try {
			parsedData = JSON.parse(cleanResponse);
		} catch (parseError: any) {
			console.error("JSON parsing failed:", parseError);
			console.error("Original AI Response:", cleanResponse);
			throw new Error(`Failed to parse AI response: ${parseError.message}`);
		}

		const words = parseAndValidateWords(parsedData);
		const filteredWords = filterInappropriateWords(words);

		return { words: filteredWords.slice(0, 20), isMock: false };
	} catch (error: any) {
		console.error("Word generation API error:", error);

		if (
			error.message?.includes("503") ||
			error.message?.includes("Service Unavailable")
		) {
			throw createError({
				statusCode: 503,
				statusMessage:
					"Gemini AI service is temporarily unavailable. Please try again later.",
			});
		}
		if (error.message?.includes("429") || error.message?.includes("quota")) {
			throw createError({
				statusCode: 429,
				statusMessage: "API usage limit exceeded. Please try again later.",
			});
		}
		if (
			error.message?.includes("401") ||
			error.message?.includes("unauthorized")
		) {
			throw createError({
				statusCode: 401,
				statusMessage: "Invalid API key. Please contact the administrator.",
			});
		}

		throw createError({
			statusCode: 500,
			statusMessage: error.message || "Failed to generate words.",
		});
	}
});

function parseAndValidateWords(parsed: any): any[] {
	if (!parsed.words || !Array.isArray(parsed.words)) {
		throw new Error("응답에 words 배열이 없습니다.");
	}

	return parsed.words.slice(0, 20).map((word: any, index: number) => {
		if (!word.word) {
			throw new Error(`${index + 1}번째 단어에 word 필드가 없습니다.`);
		}

		// AI 응답의 definitions 구조에서 데이터 추출
		let meanings = [];
		let pronunciation = "";
		let partOfSpeech = "명사";
		let description = "";

		if (word.definitions && word.definitions.length > 0) {
			const def = word.definitions[0];
			meanings = def.meaning || [];
			pronunciation = def.pronunciation || "";
			partOfSpeech = def.partOfSpeech || "명사";
			description = def.description || "";
		}

		// meanings가 배열이 아니면 배열로 변환
		if (!Array.isArray(meanings)) {
			meanings = [meanings];
		}

		return {
			word: word.word.trim(),
			meanings: meanings.map((m: string) => m.trim()),
			pronunciation: pronunciation.trim(),
			partOfSpeech: partOfSpeech.trim(),
			difficulty: word.difficulty?.trim() || "intermediate",
			usageDescription: description.trim(),
			synonyms: Array.isArray(word.synonyms)
				? word.synonyms.map((s: string) => s.trim())
				: [],
			examples: Array.isArray(word.examples)
				? word.examples.map((ex: any) => ({
						sentence: ex.sentence?.trim() || "",
						translation: ex.translation?.trim() || "",
					}))
				: [],
			quizWrongAnswers: Array.isArray(word.quizWrongAnswers)
				? word.quizWrongAnswers.map((ans: string) => ans.trim())
				: [],
			meaning: meanings[0] || "",
			example:
				word.examples && word.examples.length > 0
					? word.examples[0].sentence?.trim() || ""
					: "",
			exampleTranslation:
				word.examples && word.examples.length > 0
					? word.examples[0].translation?.trim() || ""
					: "",
		};
	});
}

function filterInappropriateWords(words: any[]): any[] {
	const inappropriatePatterns = [
		/sex|sexual|porn|adult|explicit/i,
		/fuck|shit|damn|hell|bitch/i,
		/kill|murder|death|suicide|violence/i,
		/racist|discrimination|hate/i,
	];

	return words.filter((word) => {
		const textToCheck =
			`${word.word} ${word.meaning} ${word.example}`.toLowerCase();
		return !inappropriatePatterns.some((pattern) => pattern.test(textToCheck));
	});
}
