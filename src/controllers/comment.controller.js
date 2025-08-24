"use strict";
/** @format */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.searchComments = exports.updateComment = exports.createComment = exports.getComments = void 0;
var database_1 = require("../database/database");
var zod_1 = require("zod");
var prisma;
(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, (0, database_1.connect)()];
            case 1:
                prisma = _a.sent();
                return [2 /*return*/];
        }
    });
}); })();
var CreateCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(500),
});
var UpdateCommentSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(500),
});
var CreateCommentWithTipSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(500),
    tipAmount: zod_1.z.number().min(100).max(500000).optional(),
    stickerId: zod_1.z.string().optional(),
});
var CreateCommentWithDonationSchema = zod_1.z.object({
    content: zod_1.z.string().min(1).max(500),
    donationAmount: zod_1.z.number().min(500).max(1000000).optional(),
    isAnonymous: zod_1.z.boolean().default(false),
});
var SearchCommentsSchema = zod_1.z.object({
    query: zod_1.z.string().min(1).max(100),
    limit: zod_1.z.string().optional(),
    cursor: zod_1.z.string().optional(),
    author: zod_1.z.string().optional(),
    postId: zod_1.z.string().optional(),
    sortBy: zod_1.z.enum(["desc", "asc"]).optional(),
});
// GET comments for a post with pagination and filtering
var getComments = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var postId, _a, _b, limit, cursor, author, search, _c, sortBy, post, limitNum, where, authorUser, comments, hasMore, commentsToReturn, nextCursor, error_1;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 5, , 6]);
                postId = req.params.postId;
                _a = req.query, _b = _a.limit, limit = _b === void 0 ? "20" : _b, cursor = _a.cursor, author = _a.author, search = _a.search, _c = _a.sortBy, sortBy = _c === void 0 ? "desc" : _c;
                if (!postId) {
                    return [2 /*return*/, res.status(400).json({ message: "Post ID is required" })];
                }
                return [4 /*yield*/, prisma.post.findUnique({
                        where: { id: postId },
                    })];
            case 1:
                post = _e.sent();
                if (!post) {
                    return [2 /*return*/, res.status(404).json({ message: "Post not found" })];
                }
                limitNum = Math.min(parseInt(limit), 100);
                where = {
                    postId: postId,
                    parentId: null, // Only get top-level comments, not replies
                };
                if (!author) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma.user.findUnique({
                        where: { username: author },
                        select: { uid: true },
                    })];
            case 2:
                authorUser = _e.sent();
                if (authorUser) {
                    where.authorId = authorUser.uid;
                }
                else {
                    return [2 /*return*/, res.json({ comments: [], nextCursor: null, hasMore: false })];
                }
                _e.label = 3;
            case 3:
                if (search) {
                    where.content = {
                        contains: search,
                        mode: "insensitive",
                    };
                }
                // Add cursor pagination
                if (cursor) {
                    if (sortBy === "asc") {
                        where.id = { gt: cursor };
                    }
                    else {
                        where.id = { lt: cursor };
                    }
                }
                return [4 /*yield*/, prisma.comment.findMany({
                        where: where,
                        take: limitNum + 1,
                        include: {
                            author: {
                                select: {
                                    uid: true,
                                    name: true,
                                    username: true,
                                    photoURL: true,
                                    hasBlueCheck: true,
                                },
                            },
                            tip: {
                                select: {
                                    amount: true
                                }
                            },
                            _count: {
                                select: {
                                    likes: true,
                                    replies: true,
                                },
                            },
                        },
                        orderBy: {
                            createdAt: sortBy === "asc" ? "asc" : "desc",
                        },
                    })];
            case 4:
                comments = _e.sent();
                hasMore = comments.length > limitNum;
                commentsToReturn = hasMore ? comments.slice(0, limitNum) : comments;
                nextCursor = hasMore ? (_d = commentsToReturn[commentsToReturn.length - 1]) === null || _d === void 0 ? void 0 : _d.id : null;
                res.json({
                    comments: commentsToReturn,
                    nextCursor: nextCursor,
                    hasMore: hasMore,
                    limit: limitNum,
                    sortBy: sortBy,
                });
                return [3 /*break*/, 6];
            case 5:
                error_1 = _e.sent();
                res.status(500).json({ error: "Error fetching comments" });
                return [3 /*break*/, 6];
            case 6: return [2 /*return*/];
        }
    });
}); };
exports.getComments = getComments;
// CREATE comment (authenticated only)
var createComment = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var authUser_1, postId_1, _a, content_1, tipAmount_1, donationAmount_1, stickerId_1, isAnonymous_1, validatedData, post_1, senderCredits_1, sender, requiredAmount, transactionResults, comment, paymentResult, response, postWithCounts, views, shares, likes, comments, totalEngagement, newEarnings, err_1;
    var _b, _c, _d, _e;
    return __generator(this, function (_f) {
        switch (_f.label) {
            case 0:
                _f.trys.push([0, 8, , 9]);
                authUser_1 = req.user;
                postId_1 = req.params.postId;
                _a = req.body, content_1 = _a.content, tipAmount_1 = _a.tipAmount, donationAmount_1 = _a.donationAmount, stickerId_1 = _a.stickerId, isAnonymous_1 = _a.isAnonymous;
                validatedData = void 0;
                if (tipAmount_1) {
                    validatedData = CreateCommentWithTipSchema.parse(req.body);
                }
                else if (donationAmount_1) {
                    validatedData = CreateCommentWithDonationSchema.parse(req.body);
                }
                else {
                    validatedData = CreateCommentSchema.parse(req.body);
                }
                if (!postId_1) {
                    return [2 /*return*/, res.status(400).json({ message: "Post ID is required" })];
                }
                return [4 /*yield*/, prisma.post.findUnique({
                        where: { id: postId_1 },
                        include: {
                            author: {
                                select: {
                                    uid: true,
                                    username: true,
                                    name: true,
                                },
                            },
                        },
                    })];
            case 1:
                post_1 = _f.sent();
                if (!post_1) {
                    return [2 /*return*/, res.status(404).json({ message: "Post not found" })];
                }
                // Check if user is trying to tip/donate to themselves
                if ((tipAmount_1 || donationAmount_1) && authUser_1.uid === post_1.authorId) {
                    return [2 /*return*/, res.status(400).json({ message: "You cannot send tips or donations to yourself" })];
                }
                senderCredits_1 = 0;
                if (!(tipAmount_1 || donationAmount_1)) return [3 /*break*/, 3];
                return [4 /*yield*/, prisma.user.findUnique({
                        where: { uid: authUser_1.uid },
                        select: { credits: true },
                    })];
            case 2:
                sender = _f.sent();
                if (!sender) {
                    return [2 /*return*/, res.status(404).json({ message: "User not found" })];
                }
                senderCredits_1 = sender.credits;
                requiredAmount = tipAmount_1 || donationAmount_1;
                if (senderCredits_1 < requiredAmount) {
                    return [2 /*return*/, res.status(400).json({
                            message: "Insufficient credits",
                            availableCredits: senderCredits_1,
                            requiredCredits: requiredAmount,
                        })];
                }
                _f.label = 3;
            case 3: return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(void 0, void 0, void 0, function () {
                    var comment, paymentResult, tip, tipError_1, donation, donationError_1;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, tx.comment.create({
                                    data: {
                                        content: content_1,
                                        postId: postId_1,
                                        authorId: authUser_1.uid,
                                    },
                                    include: {
                                        author: {
                                            select: {
                                                uid: true,
                                                name: true,
                                                username: true,
                                                photoURL: true,
                                                hasBlueCheck: true,
                                            },
                                        },
                                        _count: {
                                            select: {
                                                likes: true,
                                                replies: true,
                                            },
                                        },
                                    },
                                })];
                            case 1:
                                comment = _a.sent();
                                paymentResult = null;
                                if (!tipAmount_1) return [3 /*break*/, 8];
                                _a.label = 2;
                            case 2:
                                _a.trys.push([2, 7, , 8]);
                                return [4 /*yield*/, tx.tip.create({
                                        data: {
                                            senderId: authUser_1.uid,
                                            receiverId: post_1.authorId,
                                            amount: tipAmount_1,
                                            message: "Tip with comment: ".concat(content_1),
                                            postId: postId_1,
                                            stickerId: stickerId_1,
                                        },
                                    })];
                            case 3:
                                tip = _a.sent();
                                // Transfer credits
                                return [4 /*yield*/, tx.user.update({
                                        where: { uid: authUser_1.uid },
                                        data: { credits: { decrement: tipAmount_1 } },
                                    })];
                            case 4:
                                // Transfer credits
                                _a.sent();
                                return [4 /*yield*/, tx.user.update({
                                        where: { uid: post_1.authorId },
                                        data: { credits: { increment: tipAmount_1 } },
                                    })];
                            case 5:
                                _a.sent();
                                return [4 /*yield*/, tx.comment.update({
                                        where: { id: comment.id },
                                        data: { tipId: tip.id },
                                    })];
                            case 6:
                                _a.sent();
                                paymentResult = {
                                    type: "tip",
                                    status: "completed",
                                    amount: tipAmount_1,
                                    tipId: tip.id,
                                    remainingCredits: senderCredits_1 - tipAmount_1,
                                };
                                return [3 /*break*/, 8];
                            case 7:
                                tipError_1 = _a.sent();
                                console.error("Tip credit transfer failed:", tipError_1);
                                throw new Error("Failed to process tip: " + tipError_1.message);
                            case 8:
                                if (!donationAmount_1) return [3 /*break*/, 14];
                                _a.label = 9;
                            case 9:
                                _a.trys.push([9, 13, , 14]);
                                return [4 /*yield*/, tx.donation.create({
                                        data: {
                                            senderId: authUser_1.uid,
                                            receiverId: post_1.authorId,
                                            amount: donationAmount_1,
                                            message: "Donation with comment: ".concat(content_1),
                                            isAnonymous: isAnonymous_1 || false,
                                        },
                                    })];
                            case 10:
                                donation = _a.sent();
                                // Transfer credits
                                return [4 /*yield*/, tx.user.update({
                                        where: { uid: authUser_1.uid },
                                        data: { credits: { decrement: donationAmount_1 } },
                                    })];
                            case 11:
                                // Transfer credits
                                _a.sent();
                                return [4 /*yield*/, tx.user.update({
                                        where: { uid: post_1.authorId },
                                        data: { credits: { increment: donationAmount_1 } },
                                    })];
                            case 12:
                                _a.sent();
                                paymentResult = {
                                    type: "donation",
                                    status: "completed",
                                    amount: donationAmount_1,
                                    donationId: donation.id,
                                    isAnonymous: isAnonymous_1,
                                    remainingCredits: senderCredits_1 - donationAmount_1,
                                };
                                return [3 /*break*/, 14];
                            case 13:
                                donationError_1 = _a.sent();
                                console.error("Donation credit transfer failed:", donationError_1);
                                throw new Error("Failed to process donation: " + donationError_1.message);
                            case 14: return [2 /*return*/, { comment: comment, paymentResult: paymentResult }];
                        }
                    });
                }); })];
            case 4:
                transactionResults = _f.sent();
                comment = transactionResults.comment, paymentResult = transactionResults.paymentResult;
                response = __assign(__assign({}, comment), { tipAmount: tipAmount_1 || null, donationAmount: donationAmount_1 || null });
                if (paymentResult) {
                    response.payment = paymentResult;
                }
                res.status(201).json(response);
                return [4 /*yield*/, prisma.post.findUnique({
                        where: { id: postId_1 },
                        include: {
                            analytics: true,
                            _count: {
                                select: {
                                    likes: true,
                                    comments: true,
                                },
                            },
                        },
                    })];
            case 5:
                postWithCounts = _f.sent();
                if (!postWithCounts) return [3 /*break*/, 7];
                views = ((_b = postWithCounts.analytics) === null || _b === void 0 ? void 0 : _b.views) || 0;
                shares = ((_c = postWithCounts.analytics) === null || _c === void 0 ? void 0 : _c.shares) || 0;
                likes = ((_d = postWithCounts._count) === null || _d === void 0 ? void 0 : _d.likes) || 0;
                comments = ((_e = postWithCounts._count) === null || _e === void 0 ? void 0 : _e.comments) || 0;
                totalEngagement = views + shares * 2 + likes * 1.5 + comments * 3;
                newEarnings = totalEngagement >= 1000000 ? 0.01 : 0;
                return [4 /*yield*/, prisma.postAnalytics.update({
                        where: { id: postId_1 },
                        data: { earnings: newEarnings },
                    })];
            case 6:
                _f.sent();
                _f.label = 7;
            case 7: return [3 /*break*/, 9];
            case 8:
                err_1 = _f.sent();
                if (err_1.name === "ZodError") {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid payload", errors: err_1.errors })];
                }
                res.status(500).json({ error: "Error creating comment" });
                return [3 /*break*/, 9];
            case 9: return [2 /*return*/];
        }
    });
}); };
exports.createComment = createComment;
// UPDATE comment (authenticated only, author only)
var updateComment = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var authUser, id, content, existingComment, comment, err_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                authUser = req.user;
                id = req.params.id;
                content = UpdateCommentSchema.parse(req.body).content;
                if (!id) {
                    return [2 /*return*/, res.status(400).json({ message: "Comment ID is required" })];
                }
                return [4 /*yield*/, prisma.comment.findUnique({
                        where: { id: id },
                    })];
            case 1:
                existingComment = _a.sent();
                if (!existingComment) {
                    return [2 /*return*/, res.status(404).json({ message: "Comment not found" })];
                }
                if (existingComment.authorId !== authUser.uid) {
                    return [2 /*return*/, res.status(403).json({ message: "Not authorized to update this comment" })];
                }
                return [4 /*yield*/, prisma.comment.update({
                        where: { id: id },
                        data: { content: content },
                        include: {
                            author: {
                                select: {
                                    uid: true,
                                    name: true,
                                    username: true,
                                    photoURL: true,
                                    hasBlueCheck: true,
                                },
                            },
                        },
                    })];
            case 2:
                comment = _a.sent();
                res.json(comment);
                return [3 /*break*/, 4];
            case 3:
                err_2 = _a.sent();
                if (err_2.name === "ZodError") {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid payload", errors: err_2.errors })];
                }
                res.status(500).json({ error: "Error updating comment" });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.updateComment = updateComment;
// SEARCH comments globally
var searchComments = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var _a, query, _b, limit, cursor, author, postId, _c, sortBy, limitNum, where, authorUser, comments, hasMore, commentsToReturn, nextCursor, err_3;
    var _d;
    return __generator(this, function (_e) {
        switch (_e.label) {
            case 0:
                _e.trys.push([0, 4, , 5]);
                _a = SearchCommentsSchema.parse(req.query), query = _a.query, _b = _a.limit, limit = _b === void 0 ? "20" : _b, cursor = _a.cursor, author = _a.author, postId = _a.postId, _c = _a.sortBy, sortBy = _c === void 0 ? "desc" : _c;
                limitNum = Math.min(parseInt(limit), 100);
                where = {
                    content: {
                        contains: query,
                        mode: "insensitive",
                    },
                };
                if (!author) return [3 /*break*/, 2];
                return [4 /*yield*/, prisma.user.findUnique({
                        where: { username: author },
                        select: { uid: true },
                    })];
            case 1:
                authorUser = _e.sent();
                if (authorUser) {
                    where.authorId = authorUser.uid;
                }
                else {
                    return [2 /*return*/, res.json({ comments: [], nextCursor: null, hasMore: false })];
                }
                _e.label = 2;
            case 2:
                // Filter by post if specified
                if (postId) {
                    where.postId = postId;
                }
                // Add cursor pagination
                if (cursor) {
                    if (sortBy === "asc") {
                        where.id = { gt: cursor };
                    }
                    else {
                        where.id = { lt: cursor };
                    }
                }
                return [4 /*yield*/, prisma.comment.findMany({
                        where: where,
                        take: limitNum + 1,
                        include: {
                            author: {
                                select: {
                                    uid: true,
                                    name: true,
                                    username: true,
                                    photoURL: true,
                                    hasBlueCheck: true,
                                },
                            },
                            post: {
                                select: {
                                    id: true,
                                    content: true,
                                    postType: true,
                                    author: {
                                        select: {
                                            uid: true,
                                            name: true,
                                            username: true,
                                            photoURL: true,
                                            hasBlueCheck: true,
                                        },
                                    },
                                },
                            },
                        },
                        orderBy: {
                            createdAt: sortBy === "asc" ? "asc" : "desc",
                        },
                    })];
            case 3:
                comments = _e.sent();
                hasMore = comments.length > limitNum;
                commentsToReturn = hasMore ? comments.slice(0, limitNum) : comments;
                nextCursor = hasMore ? (_d = commentsToReturn[commentsToReturn.length - 1]) === null || _d === void 0 ? void 0 : _d.id : null;
                res.json({
                    comments: commentsToReturn,
                    nextCursor: nextCursor,
                    hasMore: hasMore,
                    limit: limitNum,
                    sortBy: sortBy,
                    query: query,
                });
                return [3 /*break*/, 5];
            case 4:
                err_3 = _e.sent();
                if (err_3.name === "ZodError") {
                    return [2 /*return*/, res.status(400).json({ message: "Invalid query parameters", errors: err_3.errors })];
                }
                res.status(500).json({ error: "Error searching comments" });
                return [3 /*break*/, 5];
            case 5: return [2 /*return*/];
        }
    });
}); };
exports.searchComments = searchComments;
// DELETE comment (authenticated only, author only)
var deleteComment = function (req, res) { return __awaiter(void 0, void 0, void 0, function () {
    var authUser, id, existingComment, error_2;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 3, , 4]);
                authUser = req.user;
                id = req.params.id;
                if (!id) {
                    return [2 /*return*/, res.status(400).json({ message: "Comment ID is required" })];
                }
                return [4 /*yield*/, prisma.comment.findUnique({
                        where: { id: id },
                    })];
            case 1:
                existingComment = _a.sent();
                if (!existingComment) {
                    return [2 /*return*/, res.status(404).json({ message: "Comment not found" })];
                }
                if (existingComment.authorId !== authUser.uid) {
                    return [2 /*return*/, res.status(403).json({ message: "Not authorized to delete this comment" })];
                }
                return [4 /*yield*/, prisma.comment.delete({
                        where: { id: id },
                    })];
            case 2:
                _a.sent();
                res.json({ message: "Comment deleted successfully" });
                return [3 /*break*/, 4];
            case 3:
                error_2 = _a.sent();
                res.status(500).json({ error: "Error deleting comment" });
                return [3 /*break*/, 4];
            case 4: return [2 /*return*/];
        }
    });
}); };
exports.deleteComment = deleteComment;
// Helper function to process tip payments
var processTipPayment = function (tipData) { return __awaiter(void 0, void 0, void 0, function () {
    var paypalAPI, tokenResponse, accessToken, paymentMethod, receiver, paypalOrder, approveUrl;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                paypalAPI = require("axios").create({
                    baseURL: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "Accept-Language": "en_US",
                    },
                });
                return [4 /*yield*/, paypalAPI.post("/v1/oauth2/token", "grant_type=client_credentials", {
                        headers: {
                            Authorization: "Basic ".concat(Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64")),
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    })];
            case 1:
                tokenResponse = _c.sent();
                accessToken = tokenResponse.data.access_token;
                return [4 /*yield*/, prisma.paymentMethod.findFirst({
                        where: { id: tipData.paymentMethodId, userId: tipData.senderId },
                    })];
            case 2:
                paymentMethod = _c.sent();
                if (!paymentMethod) {
                    throw new Error("Payment method not found");
                }
                return [4 /*yield*/, prisma.user.findUnique({
                        where: { uid: tipData.receiverId },
                        select: { username: true, name: true },
                    })];
            case 3:
                receiver = _c.sent();
                return [4 /*yield*/, paypalAPI.post("/v2/checkout/orders", {
                        intent: "CAPTURE",
                        purchase_units: [
                            {
                                amount: {
                                    currency_code: "PHP",
                                    value: (tipData.amount / 100).toFixed(2),
                                },
                                description: "Tip to @".concat(receiver === null || receiver === void 0 ? void 0 : receiver.username, " via comment"),
                                custom_id: "tip_comment_".concat(tipData.senderId, "_").concat(tipData.receiverId, "_").concat(tipData.amount, "_").concat(tipData.paymentMethodId),
                            },
                        ],
                        payment_source: paymentMethod.type === "paypal_wallet"
                            ? {
                                paypal: {
                                    email_address: paymentMethod.paypalEmail,
                                    experience_context: {
                                        return_url: "".concat(process.env.FRONTEND_URL, "/tip/success"),
                                        cancel_url: "".concat(process.env.FRONTEND_URL, "/tip/cancel"),
                                    },
                                },
                            }
                            : {
                                card: {
                                    vault_id: paymentMethod.paypalPaymentMethodId,
                                },
                            },
                    }, {
                        headers: {
                            Authorization: "Bearer ".concat(accessToken),
                        },
                    })];
            case 4:
                paypalOrder = _c.sent();
                approveUrl = ((_b = (_a = paypalOrder.data.links) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.rel === "approve" || link.rel === "payer-action"; })) === null || _b === void 0 ? void 0 : _b.href) || null;
                return [2 /*return*/, {
                        paymentIntentId: paypalOrder.data.id,
                        approveUrl: approveUrl,
                        amount: tipData.amount,
                        currency: "PHP",
                        status: paypalOrder.data.status,
                    }];
        }
    });
}); };
// Helper function to process donation payments
var processDonationPayment = function (donationData) { return __awaiter(void 0, void 0, void 0, function () {
    var paypalAPI, tokenResponse, accessToken, paymentMethod, receiver, paypalOrder, approveUrl;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                paypalAPI = require("axios").create({
                    baseURL: process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                        "Accept-Language": "en_US",
                    },
                });
                return [4 /*yield*/, paypalAPI.post("/v1/oauth2/token", "grant_type=client_credentials", {
                        headers: {
                            Authorization: "Basic ".concat(Buffer.from(process.env.PAYPAL_CLIENT_ID + ":" + process.env.PAYPAL_CLIENT_SECRET).toString("base64")),
                            "Content-Type": "application/x-www-form-urlencoded",
                        },
                    })];
            case 1:
                tokenResponse = _c.sent();
                accessToken = tokenResponse.data.access_token;
                return [4 /*yield*/, prisma.paymentMethod.findFirst({
                        where: { id: donationData.paymentMethodId, userId: donationData.senderId },
                    })];
            case 2:
                paymentMethod = _c.sent();
                if (!paymentMethod) {
                    throw new Error("Payment method not found");
                }
                return [4 /*yield*/, prisma.user.findUnique({
                        where: { uid: donationData.receiverId },
                        select: { username: true, name: true },
                    })];
            case 3:
                receiver = _c.sent();
                return [4 /*yield*/, paypalAPI.post("/v2/checkout/orders", {
                        intent: "CAPTURE",
                        purchase_units: [
                            {
                                amount: {
                                    currency_code: "PHP",
                                    value: (donationData.amount / 100).toFixed(2),
                                },
                                description: "Donation to @".concat(receiver === null || receiver === void 0 ? void 0 : receiver.username, " via comment"),
                                custom_id: "donation_comment_".concat(donationData.senderId, "_").concat(donationData.receiverId, "_").concat(donationData.amount, "_").concat(donationData.paymentMethodId),
                            },
                        ],
                        payment_source: paymentMethod.type === "paypal_wallet"
                            ? {
                                paypal: {
                                    email_address: paymentMethod.paypalEmail,
                                    experience_context: {
                                        return_url: "".concat(process.env.FRONTEND_URL, "/donation/success"),
                                        cancel_url: "".concat(process.env.FRONTEND_URL, "/donation/cancel"),
                                    },
                                },
                            }
                            : {
                                card: {
                                    vault_id: paymentMethod.paypalPaymentMethodId,
                                },
                            },
                    }, {
                        headers: {
                            Authorization: "Bearer ".concat(accessToken),
                        },
                    })];
            case 4:
                paypalOrder = _c.sent();
                approveUrl = ((_b = (_a = paypalOrder.data.links) === null || _a === void 0 ? void 0 : _a.find(function (link) { return link.rel === "approve" || link.rel === "payer-action"; })) === null || _b === void 0 ? void 0 : _b.href) || null;
                return [2 /*return*/, {
                        paymentIntentId: paypalOrder.data.id,
                        approveUrl: approveUrl,
                        amount: donationData.amount,
                        currency: "PHP",
                        status: paypalOrder.data.status,
                    }];
        }
    });
}); };
