// Thin re-export layer — keeps import paths stable for any code that still
// references the store directly. All logic now lives in the DB query modules.
export {
  createNegotiation,
  getNegotiation,
  getNegotiationByPhone,
  updateNegotiation,
} from '../db/queries/negotiations.js'

export {
  appendMessage,
  getMessages,
  getRecentMessages,
} from '../db/queries/messages.js'
