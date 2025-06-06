import express from "express";
import { protect } from "../controllers/auth.controllers";
import {
  addCurrency,
  createAccount,
  deleteAccount,
  deleteCurreny,
  getAccount,
  getAccounts,
  getCurrency,
  setPrimaryCurrency,
  updateAccount,
  updateCurrencyRate,
} from "../controllers/account.controller";

const router = express.Router();
router.use(protect);

// Account routes
router.route("/accounts").post(createAccount).get(getAccounts);

router
  .route("/accounts/:id")
  .get(getAccount)
  .patch(updateAccount)
  .delete(deleteAccount);

// Currency routes
router.route("/currencies").post(addCurrency).get(getCurrency);

router.patch("/currencies/:id/set-primary", setPrimaryCurrency);
router.patch("/currencies/update-rates", updateCurrencyRate);
router.delete("/currencies/:id", deleteCurreny);

export default router;
