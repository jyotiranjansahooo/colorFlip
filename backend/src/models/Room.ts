import mongoose, { Schema, type Model } from "mongoose";

interface StoredRoom {
  roomId: string;
  hostId: string;
  status: "waiting" | "playing" | "finished";
  players: Schema.Types.Mixed[];
  game: Schema.Types.Mixed | null;
  reconnectTokens: Map<string, string>;
  createdAt?: Date;
  updatedAt?: Date;
}

const roomSchema = new Schema<StoredRoom>(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
    hostId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["waiting", "playing", "finished"],
      default: "waiting",
      required: true,
    },
    players: {
      type: [Schema.Types.Mixed],
      default: [],
      required: true,
    },
    game: {
      type: Schema.Types.Mixed,
      default: null,
    },
    reconnectTokens: {
      type: Map,
      of: String,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

roomSchema.index({ updatedAt: 1 });

const existingRoomModel = mongoose.models.Room as
  | Model<StoredRoom>
  | undefined;

const RoomModel =
  existingRoomModel ?? mongoose.model<StoredRoom>("Room", roomSchema);

export default RoomModel;