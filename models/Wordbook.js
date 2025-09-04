const mongoose = require('mongoose');

const DefinitionSchema = new mongoose.Schema({
  partOfSpeech: String,
  pronunciation: String,
  meaning: [String],
  description: String
}, { _id: false });

const IdiomSchema = new mongoose.Schema({
  phrase: String,
  meaning: String
}, { _id: false });

const ExampleSchema = new mongoose.Schema({
  sentence: String,
  translation: String
}, { _id: false });

const QuizStatsSchema = new mongoose.Schema({
  correctCount: { type: Number, default: 0 },
  totalCount: { type: Number, default: 0 },
  accuracy: { type: Number, default: 0 }
}, { _id: false });

const WordSchema = new mongoose.Schema({
  wordId: String,
  word: String,
  meaning: String,
  definitions: [DefinitionSchema],
  example: String,
  exampleTranslation: String,
  examples: [ExampleSchema],
  synonyms: [String],
  antonyms: [String],
  tags: [String],
  idioms: [IdiomSchema],
  quizWrongAnswers: [String],
  addedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  lang: String,
  language: {
    category: String,
    label: String
  },
  quizStats: QuizStatsSchema,
  id: Number
}, { _id: false });

const LanguageSchema = new mongoose.Schema({
  category: String,
  label: String
}, { _id: false });

const WordbookSchema = new mongoose.Schema({
  wordbookId: String,
  wordbookName: { type: String, required: true },
  folderId: String,
  folderName: String,
  language: LanguageSchema,
  download_counts: { type: Number, default: 0 },
  coverStyle: String,
  description: String,
  words: [WordSchema],
  wordCount: { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

WordbookSchema.pre('save', function(next) {
  this.wordCount = this.words.length;
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Wordbook', WordbookSchema, 'data');