import mongoose, { Schema, models } from "mongoose";

const officeSettingSchema = new Schema(
  {
    scope: { type: String, enum: ["GLOBAL"], default: "GLOBAL", unique: true },
    officeName: { type: String, trim: true, default: "Office Billing System" },
    districtName: { type: String, trim: true, default: "Bhiwani" },
    surveyTitle: { type: String, trim: true, default: "Proceedings of the Committee Survey Report" },
    committeeParagraph: {
      type: String,
      trim: true,
      default: "The articles mentioned in the received quantity column were inspected by the committee and found in order. The accepted quantity may be brought into the stock register for official use.",
    },
    presidentLabel: { type: String, trim: true, default: "President" },
    memberOneLabel: { type: String, trim: true, default: "Member" },
    memberTwoLabel: { type: String, trim: true, default: "Member" },
    stockRegisterPage: { type: String, trim: true, default: "" },
    branchTileColumns: { type: Number, min: 3, max: 10, default: 6 },
    itemTileColumns: { type: Number, min: 3, max: 10, default: 6 },
  },
  { timestamps: true }
);

const OfficeSetting = models.OfficeSetting || mongoose.model("OfficeSetting", officeSettingSchema);
export default OfficeSetting;
