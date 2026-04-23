import { Router } from "express";
import { exchangeAuthCode } from "../services/hubspot-auth.js";

export const oauthRouter = Router();

oauthRouter.get("/hubspot/callback", async (req, res, next) => {
  try {
    const code = req.query.code;
    const wixSiteId = req.query.state;
    if (typeof code !== "string" || typeof wixSiteId !== "string") {
      res.status(400).json({ error: "Missing code/state from HubSpot callback" });
      return;
    }
    await exchangeAuthCode(code, wixSiteId);
    res.status(200).json({ connected: true });
  } catch (error) {
    next(error);
  }
});
