import { Request, Response } from "express";
import moment from "moment";
import { z } from "zod";
import { Account, IAccount } from "../models/account.models";
import { ITransaction, Transaction } from "../models/transaction.model";
import { Category, ICategory } from "../models/category.model";

const analyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  accounts: z.string().optional(),
  categories: z.string().optional(),
  type: z.enum(["expense", "income"]).optional(),
});

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, accounts, categories, type } =
      analyticsQuerySchema.parse(req.query);

    // Parse filter parameters
    const filter: any = { user: userId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (accounts) filter.account = { $in: accounts.split(",") };
    if (categories) filter.category = { $in: categories.split(",") };
    if (type) filter.type = type;

    // Get current month start and end dates
    const currentMonthStart = moment().startOf("month").toDate();
    const currentMonthEnd = moment().endOf("month").toDate();

    // Get previous month start and dates
    const prevMonthStart = moment()
      .subtract(1, "month")
      .startOf("month")
      .toDate();
    const prevMonthEnd = moment().subtract(1, "month").endOf("month").toDate();

    // Get current year start and end dates
    const currentYearStart = moment().startOf("year").toDate();
    const currentYearEnd = moment().endOf("year").toDate();

    // Get previous year start and end dates
    const prevYearStart = moment().subtract(1, "year").startOf("year").toDate();
    const prevYearEnd = moment().subtract(1, "year").endOf("year").toDate();

    // Get account balances
    const accountsData = await Account.find({
      user: userId,
      isActive: true,
    }).select("name balance currency type");

    // Total balance across all accounts
    const totalBalance = accountsData.reduce(
      (sum, account) => sum + account.balance,
      0
    );

    // Current month transactions
    const currentMonthFilter = {
      ...filter,
      date: { $gte: currentMonthStart, $lte: currentMonthEnd },
    };

    // Previous month transactions
    const prevMonthFilter = {
      ...filter,
      date: { $gte: prevMonthStart, $lte: prevMonthEnd },
    };

    // const current transactions
    const currentYearFilter = {
      ...filter,
      date: { $gte: currentYearStart, $lte: currentYearEnd },
    };

    // Previous year transactions
    const prevYearFilter = {
      ...filter,
      date: { $gte: prevYearStart, $lte: prevYearEnd },
    };

    // Execute all queries in parallel
    const [
      currentMonthExpenses,
      currentMonthIncome,
      prevMonthExpenses,
      prevMonthIncome,
      currentYearExpenses,
      currentYearIncome,
      prevYearExpenses,
      prevYearIncome,
      categorySpending,
    ] = await Promise.all([
      // Current month
      Transaction.aggregate([
        { $match: { ...currentMonthFilter, type: "expense" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { ...currentMonthFilter, type: "income" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Previous month
      Transaction.aggregate([
        { $match: { ...prevMonthFilter, type: "expense" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { ...prevMonthFilter, type: "income" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Current year
      Transaction.aggregate([
        { $match: { ...currentYearFilter, type: "expense" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { ...currentYearFilter, type: "income" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Previous year
      Transaction.aggregate([
        { $match: { ...prevYearFilter, type: "expense" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Transaction.aggregate([
        { $match: { ...prevYearFilter, type: "income" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      // Current spending
      Transaction.aggregate([
        { $match: { ...filter, type: "expense" } },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
      ]),
    ]);

    // Helper function to extract total from aggregation result
    const getTotal = (result: any[]) =>
      result.length > 0 ? result[0].total : 0;

    // Calculate trends
    const monthlyExpenseTrend =
      prevMonthExpenses.length > 0
        ? ((getTotal(currentMonthExpenses) - getTotal(prevMonthExpenses)) /
            getTotal(prevMonthExpenses)) *
          100
        : 0;

    const yearlyExpenseTrend =
      prevYearExpenses.length > 0
        ? ((getTotal(currentYearExpenses) - getTotal(prevYearExpenses)) /
            getTotal(prevYearExpenses)) *
          100
        : 0;

    // Get category details for category spending
    const categoryDetails = await Category.find({
      _id: { $in: categorySpending.map((cat: any) => cat._id) },
    });

    const enrichedCategorySpending = categorySpending.map((cat: any) => {
      const detail = categoryDetails.find((d) =>
        (d as any)._id.equals(cat._id)
      );
      return {
        ...cat,
        name: detail?.name || "Unknown",
        icon: detail?.icon || "question",
        color: detail?.color || "#999999",
      };
    });

    res.status(200).json({
      accounts: accountsData,
      totalBalance,
      currentMonth: {
        expenses: getTotal(currentMonthExpenses),
        income: getTotal(currentMonthIncome),
        net: getTotal(currentMonthIncome) - getTotal(currentMonthExpenses),
      },
      previousMonth: {
        expenses: getTotal(prevMonthExpenses),
        income: getTotal(prevMonthIncome),
        net: getTotal(prevMonthIncome) - getTotal(prevMonthExpenses),
      },
      currentYear: {
        expenses: getTotal(currentYearExpenses),
        income: getTotal(currentYearIncome),
        net: getTotal(currentYearIncome) - getTotal(currentYearExpenses),
      },
      previousYear: {
        expenses: getTotal(prevYearExpenses),
        income: getTotal(prevYearIncome),
        net: getTotal(prevYearIncome) - getTotal(prevYearExpenses),
      },
      trends: {
        monthlyExpense: monthlyExpenseTrend,
        yearlyExpense: yearlyExpenseTrend,
      },
      categorySpending: enrichedCategorySpending,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return 
    }
    res.status(500).json({ message: "Unable to get Dashboard stats" });
  }
};



export const getSpendingTrends = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, accounts, categories, type } =
      analyticsQuerySchema.parse(req.query);
    const period = req.query.period || "month"; // day, week, month, year

    // Parse filter paramters
    const filter: any = { user: userId, type: "expense" };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    if (accounts) filter.account = { $in: accounts.split(",") };
    if (categories) filter.categories = { $in: categories.split(",") };

    // Determine date grouping based on period
    let dateGroupFormat;
    switch (period) {
      case "day":
        dateGroupFormat = {
          year: { $year: "$date" },
          month: { $month: "$date" },
          day: { $dayOfMonth: "$date" },
        };
        break;
      case "week":
        dateGroupFormat = {
          year: { $year: "$date" },
          week: { $week: "$date" },
        };
        break;
      case "year":
        dateGroupFormat = {
          year: { $year: "$date" },
        };
        break;
      case "month":
      default:
        dateGroupFormat = {
          year: { $year: "$date" },
          month: { $month: "$date0" },
        };
    }

    // Get spending trends by period
    const spendingTrends = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: dateGroupFormat,
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 } },
    ]);

    // Formart the results for frontend
    const formattedTrends = spendingTrends.map((trend) => {
      let label;
      if (period === "day") {
        label = `${trend._id.year}-${trend._id.month
          .toString()
          .padStart(2, "0")}-${trend._id.day.toString().padStart(2, "0")}`;
      } else if (period === "week") {
        label = `Week ${trend._id.week}, ${trend._id.year}`;
      } else if (period === "month") {
        label = `${new Date(trend._id.year, trend._id.month - 1).toLocaleString(
          "default",
          { month: "short" }
        )} ${trend._id.year}`;
      } else if (period === "year") {
        label = `${trend._id.year}`;
      }

      return {
        period: label,
        total: trend.total,
        count: trend.count,
      };
    });
    res.status(200).json(formattedTrends);
  } catch (error) {
    if (error instanceof z.ZodError) {
       res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return
    }
    res.status(500).json({ message: "Unable to get spending trends" });
  }
};

export const getCategoryComparison = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { startDate, endDate, accounts } = analyticsQuerySchema.parse(
      req.query
    );
    const compareWith = req.query.compareWith || "previousPeriod"; // previousPeriod, samePeriodLastYear

    // Parse filter parameters
    const filter: any = { user: userId, type: "expense" };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (accounts) filter.account = { $in: accounts.split(",") };

    // Determine comparison period
    let comparisonFilter: any = { user: userId, type: "expense" };
    if (compareWith === "previousPeriod") {
      if (startDate && endDate) {
        const duration = moment(endDate).diff(
          moment(startDate),
          "milliseconds"
        );
        comparisonFilter.date = {
          $gte: moment(startDate).subtract(duration, "milliseconds").toDate(),
          $lte: moment(endDate).subtract(duration, "milliseconds").toDate(),
        };
      } else if (startDate) {
        comparisonFilter.date = { $lt: new Date(startDate) };
      } else if (endDate) {
        comparisonFilter.date = { $lt: new Date(endDate) };
      }
    } else if (compareWith === "samePeriodLastYear") {
      if (startDate && endDate) {
        comparisonFilter.date = {
          $gte: moment(startDate).subtract(1, "year").toDate(),
          $lte: moment(endDate).subtract(1, "year").toDate(),
        };
      } else {
        comparisonFilter.date = {
          $gte: moment().subtract(1, "year").startOf("year").toDate(),
          $lte: moment().subtract(1, "year").endOf("year").toDate(),
        };
      }
    }

    if (accounts) comparisonFilter.account = { $in: accounts.split(",") };

    // Get current and comparison category spending
    const [currentCategories, comparisonCategories] = await Promise.all([
      Transaction.aggregate([
        { $match: filter },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: comparisonFilter },
        {
          $group: {
            _id: "$category",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Get all unique category IDs
    const allCategoryIds = [
      ...new Set([
        ...currentCategories.map((c) => c._id),
        ...comparisonCategories.map((c) => c._id),
      ]),
    ].filter(Boolean);

    // Get category details
    const categoryDetails = await Category.find({
      _id: { $in: allCategoryIds },
    });

    // Combine results
    const result = allCategoryIds.map((categoryId) => {
      const current = currentCategories.find((c) =>
        c._id?.equals(categoryId)
      ) || { total: 0, count: 0 };
      const comparison = comparisonCategories.find((c) =>
        c._id?.equals(categoryId)
      ) || { total: 0, count: 0 };
      const category = categoryDetails.find((d) =>
        (d._id as any).equals(categoryId)
      );

      // Calculate percentage change
      const percentageChange =
        comparison.total !== 0
          ? ((current.total - comparison.total) / comparison.total) * 100
          : current.total !== 0
          ? 100
          : 0;

      return {
        category: {
          id: categoryId,
          name: category?.name || "Unknown",
          icon: category?.icon || "question",
          color: category?.color || "#999999",
        },
        current: {
          total: current.total,
          count: current.count,
        },
        comparison: {
          total: comparison.total,
          count: comparison.count,
        },
        percentageChange,
      };
    });

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return 
    }
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const getExpenseHeatMap = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user.id;
    const { startDate, endDate, accounts, categories } =
      analyticsQuerySchema.parse(req.query);

    // Parse filter parameters
    const filter: any = { user: userId, type: "expense" };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    } else {
      filter.date = {
        $gte: moment().startOf("year").toDate(),
        $lte: moment().endOf("year").toDate(),
      };
    }
    if (accounts) filter.accounts = { $in: accounts.split(",") };
    if (categories) filter.category = { $in: categories.split(",") };

    // Get Heatmap data
    const heatmapData = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
            day: { $dayOfMonth: "$date" },
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
    ]);

    // Format the results for frontend
    const formattedHeatMap = heatmapData.map((item) => ({
      date: `${item._id.year}-${item._id.month
        .toString()
        .padStart(2, "0")}-${item._id.day.toString().padStart(2, "0")}`,
      total: item.total,
      count: item.count,
    }));

    res.status(200).json(formattedHeatMap);
  } catch (error) {
    if (error instanceof z.ZodError) {
       res.status(400).json({
        message: "Validation failed",
        errors: error.errors,
      });
      return
    }
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const exportTransactions = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const { startDate, endDate, accounts, categories, type } =
      analyticsQuerySchema.parse(req.query);
    const format = req.query.format || "csv"; // csv, json

    // Parse filter parameters
    const filter: any = { user: userId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (accounts) filter.account = { $in: accounts.split(",") };
    if (categories) filter.category = { $in: categories.split(",") };
    if (type) filter.type = type;

    // Get transactions with populated fields
    // const transactions = await Transaction.find(filter)
    //   .populate("account", "name currency")
    //   .populate("category", "name")
    //   .sort({ date: -1 }) as (ITransaction & {account: IAccount} & {category: ICategory})[] ;

    const transactions = await Transaction.find(filter)
  .populate<{ account: Pick<IAccount, 'name' | 'currency'> }>("account", "name currency")
  .populate<{ category: Pick<ICategory, 'name'> }>("category", "name")
  .sort({ date: -1 });

    if (format === "csv") {
      // Convert to csv
      const header = [
        "Date",
        "Type",
        "Amount",
        "Currency",
        "Account",
        "Category",
        "Description",
        "Tags",
        "Notes",
      ].join(",");

      const rows = transactions.map((tx) => [
        moment(tx.date).format("YYYY-MM-DD"),
        tx.type,
        tx.amount,
        tx.account?.currency || "",
        tx.account?.name || "",
        tx.category?.name || "",
        `"${tx.description.replace(/"/g, '""')}"`,
        `"${tx.tags.join(', ')}"`,
        `"${tx.notes.replace(/"/g, '""')}"`,
      ].join(','));

      const csv = [header, ...rows].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=transactions.csv');
      res.status(200).send(csv);
      return 
    } else {
      // Return as JSON
      res.status(200).json(transactions);
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
       res.status(400).json({
          message: 'Validation failed',
          errors: error.errors,
        });
        return 
      }
      res.status(500).json({ message: 'Something went wrong' });
  }
};
