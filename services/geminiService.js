const { GoogleGenAI } = require("@google/genai");
const { v4: uuidv4 } = require('uuid');

const CACHED_SYSTEM_INSTRUCTION = `
You are an expert language learning assistant. Analyze the given word and provide comprehensive linguistic information in the specified JSON format.

!! CRITICAL LANGUAGE RULES - NEVER VIOLATE THESE !!:
1. synonyms: MUST be in the SAME LANGUAGE as the input word (never in Korean/한글)
2. examples sentences: MUST be in the SAME LANGUAGE as the input word (never in Korean/한글)  
3. idiom phrases: MUST be in the SAME LANGUAGE as the input word (never in Korean/한글)
4. ONLY meaning, description, translation fields should be in Korean
5. partOfSpeech: MUST ALWAYS be in KOREAN (한글) - use terms like "명사", "동사", "형용사", "부사", "전치사" etc.
6. quizWrongAnswers: MUST be 3 plausible Korean meanings that are WRONG but similar to the correct meaning
7. CONTENT FILTERING: NEVER provide offensive, profane, sexually explicit, derogatory, racist, or discriminatory content in meanings, descriptions, synonyms, examples, or any other field. Always maintain educational and respectful content.

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
      "partOfSpeech": "품사를 반드시 한글로 (예: 명사, 동사, 형용사, 부사, 전치사 등)",
      "pronunciation": "IPA pronunciation for this specific part of speech",
      "meaning": ["Primary meaning in KOREAN", "Secondary meaning in KOREAN"], 
      "description": "Detailed explanation in KOREAN for this specific part of speech"
    }
  ],
  "synonyms": ["SYNONYM_1_IN_SAME_LANGUAGE", "SYNONYM_2_IN_SAME_LANGUAGE", "SYNONYM_3_IN_SAME_LANGUAGE"],
  "examples": [
    {
      "sentence": "EXAMPLE_SENTENCE_1_IN_SAME_LANGUAGE",
      "translation": "Korean translation"
    },
    {
      "sentence": "EXAMPLE_SENTENCE_2_IN_SAME_LANGUAGE", 
      "translation": "Korean translation"
    }
  ],
  "quizWrongAnswers": ["틀린뜻1", "틀린뜻2", "틀린뜻3"],
  "addedAt": "[CURRENT_DATE]"
}
`;

class GeminiWordAnalyzer {
  constructor() {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    this.genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });
  }

  createWordAnalysisPrompt(word, selectedLanguage = null) {
    const currentDate = new Date().toISOString().split('T')[0];
    
    let languageInstructions = `
If the input word "${word}" is in English, ALL synonyms must be English words.
If the input word "${word}" is in French, ALL synonyms must be French words.
If the input word "${word}" is in Spanish, ALL synonyms must be Spanish words.
If the input word "${word}" is in any other language, ALL synonyms must be in that same language.
`;

    if (selectedLanguage) {
      const languageNames = {
        'en': 'English',
        'ko': 'Korean', 
        'ja': 'Japanese',
        'zh': 'Chinese',
        'es': 'Spanish',
        'fr': 'French'
      };
      
      const languageName = languageNames[selectedLanguage];
      if (languageName) {
        languageInstructions = `
IMPORTANT: The user has selected "${languageName}" as the preferred language for this word.
PRIORITIZE analyzing "${word}" as a ${languageName} word first.
Provide the most comprehensive and accurate analysis assuming "${word}" is a ${languageName} word.

If the input word "${word}" is determined to be in ${languageName}, ALL synonyms must be ${languageName} words.
If the input word "${word}" is determined to be in English, ALL synonyms must be English words.
If the input word "${word}" is determined to be in French, ALL synonyms must be French words.
If the input word "${word}" is determined to be in Spanish, ALL synonyms must be Spanish words.
If the input word "${word}" is determined to be in any other language, ALL synonyms must be in that same language.
`;
      }
    }

    return `
Word to analyze: "${word}"

Replace [INPUT_WORD] with "${word}" and [CURRENT_DATE] with "${currentDate}" in your JSON response.

${languageInstructions}
`;
  }

  async analyzeWord(word, selectedLanguage = null, retryCount = 0) {
    const maxRetries = 2; // 최대 2번까지 재시도 (총 3번 시도)
    
    try {
      const prompt = CACHED_SYSTEM_INSTRUCTION + '\n\n' + 
                    this.createWordAnalysisPrompt(word, selectedLanguage);
      
      const result = await this.genAI.models.generateContent({
        model: "gemini-1.5-flash-latest",
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
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        console.error('JSON parsing error:', parseError);
        console.error('Response:', response);
        throw new Error('Failed to parse AI response as JSON');
      }

      // wordbook_sample.json 형식으로 변환
      const transformedWord = this.transformToWordbookFormat(wordData, word);
      
      return transformedWord;
    } catch (error) {
      console.error(`Error analyzing word "${word}" (attempt ${retryCount + 1}):`, error.message);
      
      // 재시도 가능한 경우
      if (retryCount < maxRetries) {
        // 20초 대기
        await new Promise(resolve => setTimeout(resolve, 20000));
        
        // 재귀 호출로 재시도
        return this.analyzeWord(word, selectedLanguage, retryCount + 1);
      }
      
      // 최대 재시도 횟수 초과시 에러 던지기
      console.error(`Failed to analyze word "${word}" after ${maxRetries + 1} attempts`);
      throw error;
    }
  }

  transformToWordbookFormat(aiData, originalWord) {
    const currentDate = new Date().toISOString();
    const currentTimestamp = Date.now();

    return {
      wordId: uuidv4(),
      word: aiData.word || originalWord,
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
      addedAt: currentDate
    };
  }

  extractMainMeaning(aiData) {
    if (aiData.definitions && aiData.definitions.length > 0) {
      const firstDef = aiData.definitions[0];
      if (firstDef.meaning && firstDef.meaning.length > 0) {
        return firstDef.meaning.join(', ');
      }
    }
    return '';
  }

  extractMainExample(aiData) {
    if (aiData.examples && aiData.examples.length > 0) {
      return aiData.examples[0].sentence || '';
    }
    return '';
  }

  extractMainExampleTranslation(aiData) {
    if (aiData.examples && aiData.examples.length > 0) {
      return aiData.examples[0].translation || '';
    }
    return '';
  }

  async analyzeWordList(words, selectedLanguage = null, progressCallback = null) {
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
          await new Promise(resolve => setTimeout(resolve, 20000));
        }
      } catch (error) {
        console.error(`Failed to analyze word: ${word} after all retry attempts`, error);
        
        // 실패한 단어는 기본 형태로라도 추가 (단, 더 상세한 실패 정보 포함)
        const fallbackWord = this.createFallbackWord(word);
        fallbackWord.meaning = `분석 실패: ${error.message}`;
        fallbackWord.definitions[0].description = `AI 분석에 실패했습니다. 오류: ${error.message}`;
        fallbackWord.tags = ["분석실패", "재시도필요"];
        
        results.push(fallbackWord);
      }
    }

    return results;
  }

  createFallbackWord(word) {
    const currentDate = new Date().toISOString();
    return {
      wordId: uuidv4(),
      word: word,
      meaning: "분석 실패",
      definitions: [{
        partOfSpeech: "미분류",
        pronunciation: "",
        meaning: ["분석 실패"],
        description: "AI 분석에 실패했습니다. 나중에 수동으로 수정해주세요."
      }],
      example: "",
      exampleTranslation: "",
      examples: [],
      synonyms: [],
      antonyms: [],
      tags: ["분석실패"],
      quizWrongAnswers: ["오류1", "오류2", "오류3"],
      createdAt: currentDate,
      updatedAt: currentDate,
      id: Date.now(),
      addedAt: currentDate
    };
  }

  // 추가: 특정 단어만 재분석하는 메서드
  async reanalyzeFailedWords(wordbook) {
    const failedWords = wordbook.words.filter(word => 
      word.tags && word.tags.includes("분석실패")
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
        const wordIndex = wordbook.words.findIndex(w => w.wordId === failedWord.wordId);
        if (wordIndex !== -1) {
          // ID와 생성 시간은 유지
          reanalyzedWord.wordId = failedWord.wordId;
          reanalyzedWord.createdAt = failedWord.createdAt;
          reanalyzedWord.updatedAt = new Date().toISOString();
          
          wordbook.words[wordIndex] = reanalyzedWord;
        }
        
        // 다음 재분석까지 20초 대기
        if (i < failedWords.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 20000));
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