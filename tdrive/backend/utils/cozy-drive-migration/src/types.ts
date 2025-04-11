interface UserData {
  _id: string
  id: string
  email: string
  name: string
}

export interface MessagePayload {
  action: string
  data: UserData
}
