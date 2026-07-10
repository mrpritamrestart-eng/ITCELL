import mongoose, {
  Schema,
  models,
} from "mongoose";

const firmPreferenceSchema = new Schema(
  {
    /*
     * Filhaal poore office ke liye ek hi
     * global default firm order rahega.
     */
    scope: {
      type: String,
      required: true,
      unique: true,
      default: "GLOBAL",
      enum: ["GLOBAL"],
    },

    firstFirm: {
      type: Schema.Types.ObjectId,
      ref: "Firm",
      required: true,
    },

    secondFirm: {
      type: Schema.Types.ObjectId,
      ref: "Firm",
      required: true,
    },

    thirdFirm: {
      type: Schema.Types.ObjectId,
      ref: "Firm",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const FirmPreference =
  models.FirmPreference ||
  mongoose.model(
    "FirmPreference",
    firmPreferenceSchema
  );

export default FirmPreference;