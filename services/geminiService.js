const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require("uuid");

const CACHED_SYSTEM_INSTRUCTION = `
You are an expert language learning assistant. Analyze the given word and provide comprehensive linguistic information in the specified JSON format.

!! CRITICAL LANGUAGE RULES - NEVER VIOLATE THESE !!:
1. synonyms: MUST be in the SAME LANGUAGE as the input word (never in Korean/한글)
2. synonyms: NEVER add additional expressions like pronunciation guides, romanization, or any explanations in parentheses - ONLY the word itself
3. examples sentences: MUST be in the SAME LANGUAGE as the input word (never in Korean/한글)
4. idiom phrases: MUST be in the SAME LANGUAGE as the input word (never in Korean/한글)
5. ONLY meaning, description, translation fields should be in Korean
6. partOfSpeech: MUST ALWAYS be in KOREAN (한글) - use terms like "명사", "동사", "형용사", "부사", "전치사" etc. - NO EXCEPTIONS!
7. quizWrongAnswers: MUST be 3 plausible Korean meanings that are WRONG but similar to the correct meaning - ALWAYS IN KOREAN!
8. meaning: MUST ALWAYS be in KOREAN (한글) - NO EXCEPTIONS!
9. description: MUST ALWAYS be in KOREAN (한글) - NO EXCEPTIONS!
8. CONTENT FILTERING: NEVER provide offensive, profane, sexually explicit, derogatory, racist, or discriminatory content in meanings, descriptions, synonyms, examples, or any other field. Always maintain educational and respectful content.
9. Pronunciation: MUST ALWAYS provide pronunciation in strict IPA (International Phonetic Alphabet) format ONLY, enclosed in forward slashes: /pronunciation/. NEVER use romanization, katakana, hangul, pinyin, or any other pronunciation system. Only authentic IPA symbols are allowed.
10. JAPANESE WORD CONSISTENCY: For Japanese words, maintain the EXACT SAME writing system (hiragana, katakana, or kanji combination) throughout examples as the input word. If input is "美しい" (kanji+hiragana), use "美しい" in examples. If input is "うつくしい" (hiragana), use "うつくしい" in examples. NEVER mix writing systems within examples.

!! ULTRA-CRITICAL IPA PRONUNCIATION RULES !!:
PRONUNCIATION FIELD MUST FOLLOW THESE STRICT RULES:
- ONLY use authentic IPA (International Phonetic Alphabet) symbols
- Format: /actual_ipa_symbols/ (enclosed in forward slashes)
- NEVER use: romanization (romaji), katakana (カタカナ), hangul (한글), pinyin, or any non-IPA system
- Examples of CORRECT IPA: /ˈhæpi/, /utsɯkɯɕiː/, /ʃaŋˈhaɪ/, /paˈʁi/
- Examples of WRONG formats: /happy/, /utsukushii/, /カタカナ/, /한글/, /shanghai/, /paris/
- For languages without standard IPA, provide the closest IPA approximation
- Each part of speech may have different pronunciation if applicable

!! ULTRA-CRITICAL JAPANESE WRITING SYSTEM CONSISTENCY !!:
When creating examples for Japanese words, you MUST use the EXACT SAME writing system as the input word:
- Input "いえ" (hiragana) → Example: "私のいえは大きいです。" (using いえ in hiragana) ← CORRECT
- Input "いえ" (hiragana) → Example: "私の家は大きいです。" (using 家 in kanji) ← ABSOLUTELY WRONG!!
- Input "家" (kanji) → Example: "私の家は大きいです。" (using 家 in kanji) ← CORRECT  
- Input "家" (kanji) → Example: "私のいえは大きいです。" (using いえ in hiragana) ← ABSOLUTELY WRONG!!
- Input "きれい" (hiragana) → Example: "花がきれいです。" (using きれい) ← CORRECT
- Input "綺麗" (kanji) → Example: "花が綺麗です。" (using 綺麗) ← CORRECT
NEVER substitute equivalent words in different writing systems! This applies to ALL Japanese words regardless of meaning equivalence.

If the input word is in English, ALL synonyms must be English words.
If the input word is in French, ALL synonyms must be French words.
If the input word is in Spanish, ALL synonyms must be Spanish words.
If the input word is in any other language, ALL synonyms must be in that same language.
NEVER use Korean/한글 for synonyms, examples, or idiom phrases.

Respond with ONLY valid JSON in this exact structure:

!! IMPORTANT FOR MULTIPLE PARTS OF SPEECH !!:
- If a word has MULTIPLE parts of speech (like "present": noun and verb), create separate definition objects for each
- Each part of speech should have its own pronunciation if different (e.g., /ˈprez.ənt/ for noun, /prɪˈzent/ for verb)
- Each part of speech should have its own meanings and description
- If a word has only ONE part of speech, use a single definition object

{
  "word": "[INPUT_WORD]",
  "definitions": [
    { 
      "partOfSpeech": "품사를 반드시 한글로 (예: 명사, 동사, 형용사, 부사, 전치사 등) - MUST BE KOREAN!",
      "pronunciation": "/ˈælɡərɪðəm/ - MUST be strict IPA format only, no other pronunciation systems allowed",
      "meaning": ["Primary meaning in KOREAN", "Secondary meaning in KOREAN"] - MUST BE KOREAN!,
      "description": "단어 품사별 학습자에게 도움될 만한 상세 설명을 한국어로만 작성 - MUST BE KOREAN!"
    },
    {
      "partOfSpeech": "두 번째 품사 (다른 품사가 있을 경우에만) - MUST BE KOREAN!",
      "pronunciation": "/ˈælɡərɪðəm/ - MUST be strict IPA format only for second part of speech",
      "meaning": ["Primary meaning for second POS", "Secondary meaning for second POS"] - MUST BE KOREAN!,
       "description": "단어 품사별 학습자에게 도움될 만한 상세 설명을 한국어로만 작성 - MUST BE KOREAN!"
    }
  ],
  "synonyms": ["SYNONYM_1_IN_SAME_LANGUAGE", "SYNONYM_2_IN_SAME_LANGUAGE", "SYNONYM_3_IN_SAME_LANGUAGE"],
  "examples": [
    {
      "sentence": "EXAMPLE_SENTENCE_1_IN_SAME_LANGUAGE",
      "translation": "한국어로만 번역"
    },
    {
      "sentence": "EXAMPLE_SENTENCE_2_IN_SAME_LANGUAGE", 
      "translation": "한국어로만 번역"
    }
  ],
  "quizWrongAnswers": ["틀린뜻1", "틀린뜻2", "틀린뜻3"] - MUST BE KOREAN!,
  "addedAt": "[CURRENT_DATE]"
}

CORRECT EXAMPLE for English word "happy" (single part of speech):
{
  "word": "happy",
  "definitions": [
    {
      "partOfSpeech": "형용사",
      "pronunciation": "/ˈhæpi/",
      "meaning": ["행복한", "기쁜", "만족스러운"],
      "description": "즐거움이나 만족감을 느끼는 상태를 나타내는 형용사입니다."
    }
  ],
  "synonyms": ["joyful", "cheerful", "content", "pleased"],
  "idioms": [
    {
      "phrase": "happy as a clam",
      "meaning": "매우 행복한"
    }
  ],
  "examples": [
    {
      "sentence": "She looks very happy today.",
      "translation": "그녀는 오늘 매우 행복해 보입니다."
    },
    {
      "sentence": "I'm happy to help you with this project.",
      "translation": "이 프로젝트를 도와드릴 수 있어서 기쁩니다."
    }
  ],
  "quizWrongAnswers": ["슬픈", "화난", "피곤한"],
  "addedAt": "2023-10-01"
}

CORRECT EXAMPLE for English word "present" (multiple parts of speech):
{
  "word": "present",
  "definitions": [
    {
      "partOfSpeech": "명사",
      "pronunciation": "/ˈprez.ənt/",
      "meaning": ["선물", "현재"],
      "description": "누군가에게 주는 물건이나 현재 시점을 나타내는 명사입니다."
    },
    {
      "partOfSpeech": "동사",
      "pronunciation": "/prɪˈzent/",
      "meaning": ["발표하다", "제공하다", "증정하다"],
      "description": "무언가를 보여주거나 제공하는 행위를 나타내는 동사입니다."
    }
  ],
  "synonyms": ["gift", "offering", "show", "display", "give"],
  "idioms": [
    {
      "phrase": "present company excluded",
      "meaning": "현재 여기 있는 사람들은 제외하고"
    }
  ],
  "examples": [
    {
      "sentence": "She gave me a beautiful present for my birthday.",
      "translation": "그녀는 내 생일에 아름다운 선물을 주었습니다."
    },
    {
      "sentence": "I will present my findings at the meeting.",
      "translation": "회의에서 내 연구 결과를 발표할 것입니다."
    }
  ],
  "quizWrongAnswers": ["과거", "미래", "숨기다"],
  "addedAt": "2023-10-01"
}

CORRECT EXAMPLE for Japanese word "美しい":
{
  "word": "美しい",
  "definitions": [
    {
      "partOfSpeech": "형용사",
      "pronunciation": "/utsɯkɯɕiː/",
      "meaning": ["아름답다", "예쁘다", "멋지다"],
      "description": "시각적으로나 감정적으로 아름다움을 느끼게 하는 상태를 나타내는 형용사입니다."
    }
  ],
  "synonyms": ["きれい", "素晴らしい", "綺麗", "魅力的"],
  "idioms": [
    {
      "phrase": "美しい人生",
      "meaning": "아름다운 인생"
    }
  ],
  "examples": [
    {
      "sentence": "この花はとても美しいです。",
      "translation": "이 꽃은 매우 아름답습니다."
    },
    {
      "sentence": "美しい音楽を聞いています。",
      "translation": "아름다운 음악을 듣고 있습니다."
    }
  ],
  "quizWrongAnswers": ["못생긴", "더러운", "추한"],
  "addedAt": "2023-10-01"
}

!! QUIZ WRONG ANSWERS GENERATION RULES !!:
- quizWrongAnswers must be exactly 3 Korean meanings that are INCORRECT but plausible - ALWAYS IN KOREAN (한글)!
- They should be meanings that could confuse someone learning the word
- They must be different from the correct meaning but semantically related if possible
- CRITICAL: ALL quizWrongAnswers MUST be written in Korean - NO EXCEPTIONS!
- Examples:
  * For "happy" (행복한): wrong answers could be ["슬픈", "화난", "피곤한"]
  * For "run" (달리다): wrong answers could be ["걷다", "뛰어오르다", "멈추다"]
  * For "book" (책): wrong answers could be ["잡지", "신문", "편지"]

LANGUAGE-SPECIFIC EXAMPLES:
- For English word "happy": synonyms = ["joyful", "cheerful", "content"] ← CORRECT
- For Japanese word "美しい": synonyms = ["きれい", "素晴らしい", "綺麗"] ← CORRECT
- For Chinese word "快乐": synonyms = ["愉快", "高兴", "喜悦"] ← CORRECT
- For Korean word "행복한": synonyms = ["즐거운", "기쁜", "만족스러운"] ← CORRECT
- For ANY language: synonyms = ["한글단어", "Korean", "words"] ← WRONG!! NEVER DO THIS
- WRONG examples with additional info: ["きれい (kirei)", "美しい (utsukushii)", "content (happy)"] ← NEVER ADD PARENTHESES OR EXPLANATIONS

JAPANESE WRITING SYSTEM CONSISTENCY EXAMPLES:
- Input: "美しい" (kanji+hiragana) → Example: "この花は美しいです。" ← CORRECT (uses same kanji+hiragana)
- Input: "うつくしい" (hiragana only) → Example: "この花はうつくしいです。" ← CORRECT (uses same hiragana)
- Input: "美しい" → Example: "この花はうつくしいです。" ← WRONG!! (mixing kanji+hiragana with hiragana)
- Input: "うつくしい" → Example: "この花は美しいです。" ← WRONG!! (mixing hiragana with kanji+hiragana)

MORE CRITICAL EXAMPLES:
- Input: "いえ" (hiragana) → Example: "私のいえは大きいです。" ← CORRECT
- Input: "いえ" (hiragana) → Example: "私の家は大きいです。" ← WRONG!! (substituting 家 for いえ)
- Input: "家" (kanji) → Example: "私の家は大きいです。" ← CORRECT
- Input: "家" (kanji) → Example: "私のいえは大きいです。" ← WRONG!! (substituting いえ for 家)

REMEMBER:
1. synonyms must match the input word's language, NEVER Korean!
2. NEVER add pronunciation guides or explanations in parentheses!
3. For Japanese words, maintain exact writing system consistency!
4. PRONUNCIATION MUST BE STRICT IPA FORMAT ONLY - NO exceptions! Use /ipa_symbols/ format exclusively!
5. partOfSpeech MUST ALWAYS BE IN KOREAN (한글) - NO EXCEPTIONS!
6. meaning MUST ALWAYS BE IN KOREAN (한글) - NO EXCEPTIONS!
7. description MUST ALWAYS BE IN KOREAN (한글) - NO EXCEPTIONS!
8. quizWrongAnswers MUST ALWAYS BE IN KOREAN (한글) - NO EXCEPTIONS!
`;

class GeminiWordAnalyzer {
	constructor() {
		if (!process.env.GEMINI_API_KEY) {
			throw new Error("GEMINI_API_KEY environment variable is required");
		}

		this.genAI = new GoogleGenAI({
			apiKey: process.env.GEMINI_API_KEY,
		});
	}

	createWordAnalysisPrompt(word, selectedLanguage = null, wordbookDescription = null) {
		const currentDate = new Date().toISOString().split("T")[0];

		let languageInstructions = `
If the input word "${word}" is in English, ALL synonyms must be English words.
If the input word "${word}" is in Korean, ALL synonyms must be Korean words.
If the input word "${word}" is in Japanese, ALL synonyms must be Japanese words.
If the input word "${word}" is in Chinese, ALL synonyms must be Chinese words.
If the input word "${word}" is in any other language, ALL synonyms must be in that same language.
`;

		if (selectedLanguage) {
			const languageNames = {
				en: "English",
				ko: "Korean",
				ja: "Japanese",
				zh: "Chinese",
			};

			const languageName = languageNames[selectedLanguage];
			if (languageName) {
				languageInstructions = `
IMPORTANT: The user has selected "${languageName}" as the preferred language for this word.
PRIORITIZE analyzing "${word}" as a ${languageName} word first.
Provide the most comprehensive and accurate analysis assuming "${word}" is a ${languageName} word.

If the input word "${word}" is determined to be in ${languageName}, ALL synonyms must be ${languageName} words.
If the input word "${word}" is determined to be in English, ALL synonyms must be English words.
If the input word "${word}" is determined to be in Korean, ALL synonyms must be Korean words.
If the input word "${word}" is determined to be in Japanese, ALL synonyms must be Japanese words.
If the input word "${word}" is determined to be in Chinese, ALL synonyms must be Chinese words.
If the input word "${word}" is determined to be in any other language, ALL synonyms must be in that same language.
`;
			}
		}

		let contextInstructions = '';
		if (wordbookDescription && wordbookDescription.trim()) {
			contextInstructions = `

!! WORDBOOK CONTEXT - CRITICAL !!:
This word is being added to a wordbook with the following description/theme:
"${wordbookDescription}"

IMPORTANT: When a word has MULTIPLE MEANINGS, you MUST prioritize the meaning that best fits this wordbook's context and theme.
- Select definitions, meanings, and examples that align with the wordbook's purpose
- If the word has multiple parts of speech, focus on the ones most relevant to this context
- Ensure examples and synonyms reflect the usage that matches this wordbook's theme
- For example, if the wordbook is about "Business English" and the word is "present", prioritize the verb meaning (to present/show) over the noun meaning (gift)
- If the wordbook is about "TOEIC Essential Words", focus on common business and professional usage
`;
		}

		return (
			CACHED_SYSTEM_INSTRUCTION +
			`

Word to analyze: "${word}"

Replace [INPUT_WORD] with "${word}" and [CURRENT_DATE] with "${currentDate}" in your JSON response.

${languageInstructions}
${contextInstructions}
`
		);
	}

	async analyzeWord(word, selectedLanguage = null, wordbookDescription = null, retryCount = 0) {
		const maxRetries = 2; // 최대 2번까지 재시도 (총 3번 시도)

		try {
			const prompt = this.createWordAnalysisPrompt(word, selectedLanguage, wordbookDescription);

			const result = await this.genAI.models.generateContent({
				model: "gemini-2.0-flash-lite",
				contents: prompt,
				config: {
					generationConfig: { responseMimeType: "application/json" },
				},
			});

			const response = result.text;

			// JSON 응답 파싱
			let wordData;
			try {
				// 응답에서 JSON 부분만 추출
				const jsonMatch = response.match(/\{[\s\S]*\}/);
				if (jsonMatch) {
					wordData = JSON.parse(jsonMatch[0]);
				} else {
					throw new Error("No JSON found in response");
				}
			} catch (parseError) {
				console.error("JSON parsing error:", parseError);
				console.error("Response:", response);
				throw new Error("Failed to parse AI response as JSON");
			}

			// wordbook_sample.json 형식으로 변환
			const transformedWord = this.transformToWordbookFormat(wordData, word, selectedLanguage);

			return transformedWord;
		} catch (error) {
			console.error(
				`Error analyzing word "${word}" (attempt ${retryCount + 1}):`,
				error.message
			);

			// 재시도 가능한 경우
			if (retryCount < maxRetries) {
				// 20초 대기
				await new Promise((resolve) => setTimeout(resolve, 20000));

				// 재귀 호출로 재시도
				return this.analyzeWord(word, selectedLanguage, wordbookDescription, retryCount + 1);
			}

			// 최대 재시도 횟수 초과시 에러 던지기
			console.error(
				`Failed to analyze word "${word}" after ${maxRetries + 1} attempts`
			);
			throw error;
		}
	}

	transformToWordbookFormat(aiData, originalWord, languageCategory = null) {
		const currentDate = new Date().toISOString();
		const currentTimestamp = Date.now();

		return {
			wordId: uuidv4(),
			word: aiData.word || originalWord,
			lang: languageCategory,
			meaning: this.extractMainMeaning(aiData),
			definitions: aiData.definitions || [],
			example: this.extractMainExample(aiData),
			exampleTranslation: this.extractMainExampleTranslation(aiData),
			examples: aiData.examples || [],
			synonyms: aiData.synonyms || [],
			antonyms: aiData.antonyms || [],
			tags: ["AI생성"],
			quizWrongAnswers: aiData.quizWrongAnswers || [],
			createdAt: currentDate,
			updatedAt: currentDate,
			id: currentTimestamp,
			addedAt: currentDate,
		};
	}

	extractMainMeaning(aiData) {
		if (aiData.definitions && aiData.definitions.length > 0) {
			const firstDef = aiData.definitions[0];
			if (firstDef.meaning && firstDef.meaning.length > 0) {
				return firstDef.meaning.join(", ");
			}
		}
		return "";
	}

	extractMainExample(aiData) {
		if (aiData.examples && aiData.examples.length > 0) {
			return aiData.examples[0].sentence || "";
		}
		return "";
	}

	extractMainExampleTranslation(aiData) {
		if (aiData.examples && aiData.examples.length > 0) {
			return aiData.examples[0].translation || "";
		}
		return "";
	}

	async analyzeWordList(
		words,
		selectedLanguage = null,
		progressCallback = null
	) {
		const results = [];

		for (let i = 0; i < words.length; i++) {
			const word = words[i].trim();
			if (!word) continue;

			try {
				if (progressCallback) {
					progressCallback(i + 1, words.length, word);
				}

				const analyzedWord = await this.analyzeWord(word, selectedLanguage);
				results.push(analyzedWord);

				// Rate limiting - 요청 간격을 20초로 증가
				if (i < words.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 20000));
				}
			} catch (error) {
				console.error(
					`Failed to analyze word: ${word} after all retry attempts`,
					error
				);

				// 실패한 단어는 기본 형태로라도 추가 (단, 더 상세한 실패 정보 포함)
				const fallbackWord = this.createFallbackWord(word, selectedLanguage);
				fallbackWord.meaning = `분석 실패: ${error.message}`;
				fallbackWord.definitions[0].description = `AI 분석에 실패했습니다. 오류: ${error.message}`;
				fallbackWord.tags = ["분석실패", "재시도필요"];

				results.push(fallbackWord);
			}
		}

		return results;
	}

	createFallbackWord(word, languageCategory = null) {
		const currentDate = new Date().toISOString();
		return {
			wordId: uuidv4(),
			word: word,
			lang: languageCategory,
			meaning: "분석 실패",
			definitions: [
				{
					partOfSpeech: "미분류",
					pronunciation: "",
					meaning: ["분석 실패"],
					description: "AI 분석에 실패했습니다. 나중에 수동으로 수정해주세요.",
				},
			],
			example: "",
			exampleTranslation: "",
			examples: [],
			synonyms: [],
			antonyms: [],
			tags: ["분석실패"],
			quizWrongAnswers: ["오류1", "오료2", "오류3"],
			createdAt: currentDate,
			updatedAt: currentDate,
			id: Date.now(),
			addedAt: currentDate,
		};
	}

	// 추가: 특정 단어만 재분석하는 메서드
	async reanalyzeFailedWords(wordbook) {
		const failedWords = wordbook.words.filter(
			(word) => word.tags && word.tags.includes("분석실패")
		);

		if (failedWords.length === 0) {
			return wordbook;
		}

		for (let i = 0; i < failedWords.length; i++) {
			const failedWord = failedWords[i];

			try {
				const reanalyzedWord = await this.analyzeWord(
					failedWord.word,
					wordbook.language ? wordbook.language.category : null
				);

				// 원래 단어를 재분석된 단어로 교체
				const wordIndex = wordbook.words.findIndex(
					(w) => w.wordId === failedWord.wordId
				);
				if (wordIndex !== -1) {
					// ID와 생성 시간은 유지
					reanalyzedWord.wordId = failedWord.wordId;
					reanalyzedWord.createdAt = failedWord.createdAt;
					reanalyzedWord.updatedAt = new Date().toISOString();

					wordbook.words[wordIndex] = reanalyzedWord;
				}

				// 다음 재분석까지 20초 대기
				if (i < failedWords.length - 1) {
					await new Promise((resolve) => setTimeout(resolve, 20000));
				}
			} catch (error) {
				console.error(`Failed to reanalyze word: ${failedWord.word}`, error);
				// 재분석도 실패한 경우, 원래 상태 유지
			}
		}

		return wordbook;
	}
}

module.exports = GeminiWordAnalyzer;
