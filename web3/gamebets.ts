import * as functions from "firebase-functions";
import { firestore } from "firebase-admin";
import { logError } from "../helpers/error-logging";
import { verifyAuth } from "../utils";
// import { complete } from "./image-resizer/logs";
// import Analytics from "./helpers/analytics"; 
import { GAMES_DATA } from "../data/data";
import Logger from "../logger"; 
import { unixTimestamp } from "../utils";
// import { get } from "http";
import { 
    getActionType,
    handleOtherPlayerTurn,
    getWinnerForCompletedChallenge,
    handleChallengeCompleteWithReplay
} from '../games';

const admin = require("firebase-admin");
// const fetch = require("node-fetch");
const db = admin.firestore();

const GAMES_CONFIG = GAMES_DATA;

const matchesRunTimeOptions: any = {
    timeoutSeconds: 540,
    memory: "4GB",
  };

async function deposit(player: string, betAmount: number, challengeId: string): Promise<string> {
    return `${player}-${betAmount}-${challengeId}`;
}

async function dispense(signature, gameChallengeId, winningPlayer) {
    return `${signature}-${gameChallengeId}-${winningPlayer}`;
}

async function cancelGame(signature, gameChallengeId) {
    return `${signature}-${gameChallengeId}`;
}

function createGameChallengeId(gameId: string, challengeId: string): string {
    return `${gameId}-${challengeId}`;
}

function getGameAndChallengeIds(gameChallengeId: string): { gameId: string, challengeId: string } {
    const [gameId, challengeId] = gameChallengeId.split('-');
    return { gameId, challengeId };
}

export const createBetChallengeRoom = functions.https.onCall(
    async (data, context) => {
      verifyAuth(context);
      const userId = context.auth!.uid;
  
      const {
        userInfo,
        gameId,
        challengeId,
        previousChallenge,
        friendId,
        friendName,
        betAmount
      } = data;
      const { snapDisplayName, bitmojiUrl } = userInfo;
  
      let currentDateTimeStamp = unixTimestamp();
  
      let challengeRoomRef = db
        .collection("betGames")
        .doc(gameId)
        .collection("challengeRooms")
        .doc(challengeId);

      let gameChallengeId = createGameChallengeId(gameId, challengeId);

      let player1Deeplink = deposit("player1", betAmount, gameChallengeId);
      let player2Deeplink = deposit("player2", betAmount, gameChallengeId);

      let challengeRoom: any = {
        lastPlayerId: userId,
        gameId: gameId,
        lastGhostPlay: null,
        createdAt: currentDateTimeStamp,
        id: challengeId,
        senderId: userId,
        players: {
          [userId]: {
            score: null,
            snapDisplayName: snapDisplayName,
            bitmojiUrl: bitmojiUrl,
            player: "player1",
            depositReceived: false,
          },
        },
        winner: null,
        betAmount: betAmount,
        status: "waitingForDeposit",
        player1Deeplink: player1Deeplink,
        player2Deeplink: player2Deeplink,
      };
  
      if (friendId) {
        challengeRoom.players[friendId] = {
          score: null,
          snapDisplayName: friendName,
          player: "player2",
          depositReceived: false,
        };
      }
  
      if (GAMES_CONFIG[gameId].type !== "synchronous") {
        let maxPlayers = GAMES_CONFIG[gameId].maxPlayers ?? 2;
        if (maxPlayers <= 2) {
          challengeRoom = {
            ...challengeRoom,
            didExpire: false,
            didSendExpirationWarning: false,
            lastActionDate: currentDateTimeStamp,
          };
        }
      }
      try {
        await challengeRoomRef.set(challengeRoom);
      } catch (error) {
        Logger.error(error.message, {
          userInfo,
          gameId,
          challengeId,
          previousChallenge,
          friendId,
          friendName,
        });
      }
      // :todo should return error
      return JSON.stringify(challengeRoom);
    }
  );

  export const updateBetGameChallengeRoom = functions.https.onCall(
    async (data, context) => {
      const userId = context.auth!.uid;
  
      let { userInfo, gameId, challengeId, otherUserId } = data;
  
      userInfo.uid = userId;
  
      const gameType = GAMES_CONFIG[gameId].type;
  
      const lastGhostPlayStringified = data.lastGhostPlay;
      let lastGhostPlay: any = {};
  
      try {
        if (typeof lastGhostPlayStringified !== "object") {
          lastGhostPlay = JSON.parse(lastGhostPlayStringified);
        } else {
          // should always be a string, so this should probably be an error instead
          lastGhostPlay = lastGhostPlayStringified;
        }
  
        let challengeRoomRef = db
          .collection("betGames")
          .doc(gameId)
          .collection("challengeRooms")
          .doc(challengeId);
  
        // await createChallengeRoomIfItDoesNotExist({
        //   userId,
        //   gameId,
        //   challengeId,
        //   userInfo,
        // });
  
        let userRef = db.collection("users").doc(userId);
  
        let updatedChallengeRoom = await db.runTransaction(
          async (transaction) => {
            let [challengeRoomSnapshot, currentUserInfoSnapshot] =
              await Promise.all([
                transaction.get(challengeRoomRef),
                transaction.get(userRef),
              ]);
  
            var currentChallengeRoomData = challengeRoomSnapshot.data();
  
            if (!currentChallengeRoomData) {
              throw new Error("Challenge room does not exist");
            }
  
            var currentUserInfo = currentUserInfoSnapshot.data();
  
            let currentPlayers = currentChallengeRoomData.players;
  
            for (let player in currentPlayers) {
              if (player !== userId) {
                otherUserId = player;
              }
            }
  
            let gameStatus = getActionType({
              gameType,
              challengeRoom: currentChallengeRoomData,
              lastGhostPlay,
            });
  
            let updatedChallengeRoom;
  
            switch (gameStatus) {
              case "otherPlayerTurn":
                updatedChallengeRoom = await handleOtherPlayerTurn({
                  currentChallengeRoomData,
                  userInfo,
                  currentUserInfo,
                  lastGhostPlay,
                  transaction,
                  otherUserId,
                  userId,
                  gameId,
                  challengeRoomRef,
                });
                break;
              case "complete":
                updatedChallengeRoom = await handleBetChallengeCompleted({
                  currentChallengeRoomData,
                  userInfo,
                  lastGhostPlay,
                  transaction,
                  otherUserId,
                  userId,
                  currentUserInfo,
                  gameId,
                  challengeRoomRef,
                });
                break;
  
              case "completeWithReplay":
                updatedChallengeRoom = await handleChallengeCompleteWithReplay({
                  challengeRoomRef,
                  transaction,
                  currentChallengeRoomData,
                  lastGhostPlayStringified,
                });
  
                break;
              default:
                updatedChallengeRoom = "challenge_room_error";
                throw new Error("Game status could not be determined");
            }
  
            return updatedChallengeRoom;
          }
        );
  
        return JSON.stringify(updatedChallengeRoom);
      } catch (error) {
        Logger.error(error, {
          userInfo,
          gameId,
          challengeId,
          lastGhostPlay,
          otherUserId,
        });
      }
  
      return "error";
    }
  );

  async function handleBetChallengeCompleted({
    currentChallengeRoomData,
    userInfo,
    lastGhostPlay,
    transaction,
    otherUserId,
    userId,
    currentUserInfo,
    gameId,
    challengeRoomRef,
  }) {
    var userWinsLosses = {
      wins: currentUserInfo.friends[otherUserId]?.["games"]?.[gameId]?.wins ?? 0,
      losses:
        currentUserInfo.friends[otherUserId]?.["games"]?.[gameId]?.losses ?? 0,
    };
  
    let gameCompleteInfo = getBetChallengeRoomForChallengeCompleted({
      challengeRoom: currentChallengeRoomData,
      userInfo,
      userWinsLosses,
      gameId,
      lastGhostPlay,
      otherUserId,
    });

    console.log("dispense result: ", gameCompleteInfo.dispenseResult);
  
    let currentUserRef = db.collection("users").doc(userId);
    let otherUserRef = db.collection("users").doc(otherUserId);
  
    let updatedChallengeRoom = gameCompleteInfo.newChallengeRoom;
    let updatedCurrentUser = gameCompleteInfo.currentUserUpdates;
    let updatedOtherUser = gameCompleteInfo.otherUserUpdates;
  
    //   let promises = [];
  
    if (updatedCurrentUser) {
      transaction.update(currentUserRef, updatedCurrentUser);
      // promises.push(transaction.update(currentUserRef, updatedCurrentUser));
    }
    if (updatedChallengeRoom) {
      transaction.update(challengeRoomRef, updatedChallengeRoom);
      // promises.push(transaction.update(challengeRoomRef, updatedChallengeRoom));
    }
    if (updatedOtherUser) {
      transaction.update(otherUserRef, updatedOtherUser);
      // promises.push(transaction.update(otherUserRef, updatedOtherUser));
    }
  
    //   await Promise.all(promises);
  
    return updatedChallengeRoom;
  }

  function getBetChallengeRoomForChallengeCompleted({
    challengeRoom,
    userInfo,
    userWinsLosses,
    gameId,
    lastGhostPlay,
    otherUserId,
  }) {
    const { uid, bitmojiUrl, snapDisplayName } = userInfo;
    const currentScore = lastGhostPlay.score ?? null;
    const gameType = GAMES_CONFIG[gameId].type;
    const userId = uid;
  
    let winner = getWinnerForCompletedChallenge({
      challengeRoom,
      gameId,
      lastGhostPlay,
      userId,
      otherUserId,
    });
  
    if (!winner) {
      Logger.error("Could not determine winner", {
        challengeRoom,
        gameId,
        lastGhostPlay,
        userId,
        otherUserId,
        gameType,
      });
  
      throw new Error("Could not determine winner");
    }
  
    let currentUserUpdates;
    let otherUserUpdates;
  
    let currentPlayerWins = userWinsLosses?.wins ?? 0;
    let currentPlayerLosses = userWinsLosses?.losses ?? 0;
  
    let otherPlayerWins = userWinsLosses?.losses ?? 0;
    let otherPlayerLosses = userWinsLosses?.wins ?? 0;
  
    let currentUserWinsLossBasePath = "wins";
    let currentUserGamesWinsLossBasePath = "games." + gameId;
    let currentUserFriendWinLossPath =
      "friends." + otherUserId + ".games." + gameId;
  
    let otherUserWinsLossBasePath = "wins";
    let otherUserGamesWinsLossBasePath = "games." + gameId;
    let otherUserFriendWinLossPath = "friends." + userId + ".games." + gameId;
  
    if (winner === userId) {
      currentUserWinsLossBasePath = "wins";
      currentUserGamesWinsLossBasePath =
        currentUserGamesWinsLossBasePath + ".wins";
      currentUserFriendWinLossPath = currentUserFriendWinLossPath + ".wins";
  
      otherUserWinsLossBasePath = "losses";
      otherUserGamesWinsLossBasePath = otherUserGamesWinsLossBasePath + ".losses";
      otherUserFriendWinLossPath = otherUserFriendWinLossPath + ".losses";
  
      currentPlayerWins = currentPlayerWins + 1;
      otherPlayerLosses = otherPlayerLosses + 1;
    } else if (winner === otherUserId) {
      currentUserWinsLossBasePath = "losses";
      currentUserGamesWinsLossBasePath =
        currentUserGamesWinsLossBasePath + ".losses";
      currentUserFriendWinLossPath = currentUserFriendWinLossPath + ".losses";
  
      otherUserWinsLossBasePath = "wins";
      otherUserGamesWinsLossBasePath = otherUserGamesWinsLossBasePath + ".wins";
      otherUserFriendWinLossPath = otherUserFriendWinLossPath + ".wins";
  
      currentPlayerLosses = currentPlayerLosses + 1;
      otherPlayerWins = otherPlayerWins + 1;
    } else if (winner == "tie") {
      currentUserWinsLossBasePath = "ties";
      currentUserGamesWinsLossBasePath =
        currentUserGamesWinsLossBasePath + ".ties";
      currentUserFriendWinLossPath = currentUserFriendWinLossPath + ".ties";
  
      otherUserWinsLossBasePath = "ties";
      otherUserGamesWinsLossBasePath = otherUserGamesWinsLossBasePath + ".ties";
      otherUserFriendWinLossPath = otherUserFriendWinLossPath + ".ties";
    }
  
    currentUserUpdates = {
      [currentUserWinsLossBasePath]: admin.firestore.FieldValue.increment(1),
      [currentUserGamesWinsLossBasePath]: admin.firestore.FieldValue.increment(1),
      [currentUserFriendWinLossPath]: admin.firestore.FieldValue.increment(1),
    };
  
    otherUserUpdates = {
      [otherUserWinsLossBasePath]: admin.firestore.FieldValue.increment(1),
      [otherUserGamesWinsLossBasePath]: admin.firestore.FieldValue.increment(1),
      [otherUserFriendWinLossPath]: admin.firestore.FieldValue.increment(1),
    };
  
    let currentUserLeagueUpdates;
    let otherUserLeagueUpdates;
  
    let newChallengeRoom = challengeRoom;
  
    newChallengeRoom.lastPlayerId = userId;
    newChallengeRoom.lastGhostPlay = JSON.stringify(lastGhostPlay);
  
    if (challengeRoom.createdAt) {
      let currentDateTimeStamp = unixTimestamp();
  
      let timeToCompletion = currentDateTimeStamp - challengeRoom.createdAt;
  
      newChallengeRoom.timeToCompletion = timeToCompletion;
    }
    let results = lastGhostPlay.results
      ? JSON.stringify(lastGhostPlay.results)
      : null;
  
    if (newChallengeRoom.players[userId]) {
      newChallengeRoom.players[userId] = {
        ...newChallengeRoom.players[userId],
        score: currentScore,
        snapDisplayName: snapDisplayName,
        bitmojiUrl: bitmojiUrl,
        wins: currentPlayerWins,
        losses: currentPlayerLosses,
        results: results,
        hasPlayed: true,
      };
    } else {
      newChallengeRoom.players[userId] = {
        score: currentScore,
        snapDisplayName: snapDisplayName,
        bitmojiUrl: bitmojiUrl,
        wins: currentPlayerWins,
        losses: currentPlayerLosses,
        results: results,
        hasPlayed: true,
      };
    }
  
    if (!newChallengeRoom.players[otherUserId]) {
      throw new Error(
        `Missing other player ID for challenge room ${newChallengeRoom.id}. ${userId}. ${otherUserId}. ${newChallengeRoom.gameId}. ${winner}.`
      );
    }
  
    // Other player
    newChallengeRoom.players[otherUserId].wins = otherPlayerWins;
    newChallengeRoom.players[otherUserId].losses = otherPlayerLosses;
  
    if (gameType === "score_new") {
      newChallengeRoom.players[userId].score = lastGhostPlay.scores[userId];
      newChallengeRoom.players[otherUserId].score =
        lastGhostPlay.scores[otherUserId];
    }
  
    newChallengeRoom.shouldShowLastReplay =
      gameType === "elimination" ? true : null;
    newChallengeRoom.winner = winner;

    let gameChallengeId = createGameChallengeId(gameId, newChallengeRoom.id);
    let dispenseResult;

    if (winner === "tie") {
        dispenseResult = cancelGame('signature', gameChallengeId);
    } else {
        let winningPlayer = newChallengeRoom.players[winner].player;
        dispenseResult = dispense('signature', gameChallengeId, winningPlayer);
    }

    newChallengeRoom.status = "waitingDispense";
  
    return {
      newChallengeRoom,
      currentUserUpdates,
      otherUserUpdates,
      currentUserLeagueUpdates,
      otherUserLeagueUpdates,
      dispenseResult
    };
  }

  interface Player {
    player: string;
    depositReceived: boolean;
}

exports.gamebetsWebhook = functions.https.onRequest(async (req, res) => {
    const data = req.body;
    console.log(" webhook data: ", data);

    const transactionType = data.transactionType;
    const player = data.player;
    const gameChallengeId = data.gameId;

    const { gameId, challengeId } = getGameAndChallengeIds(gameChallengeId);

    const gameRef = db.collection("betGames").doc(gameId).collection("challengeRooms").doc(challengeId);

    const currTime = unixTimestamp();

    const transactionRes = await db.runTransaction(async (transaction) => {
        const gameSnapshot = await transaction.get(gameRef);
        const gameData = gameSnapshot.data();
        const players: { [key: string]: Player} = gameData.players;

        if (transactionType == "deposit") {
            let userId;
        for (const userKey in players) {
            if (players[userKey].player === player) {
                userId = userKey;
                players[userKey].depositReceived = true;
                break;
            }
        }

        if (!userId) {
            throw new Error(`User ID for ${player} not found`);
        }

        const allDepositsReceived = Object.values(players).every(player => player.depositReceived);

        if (allDepositsReceived) {
            transaction.update(gameRef, {
                status: "waitingGameResult",
                allDepositsReceived: currTime
            }, {merge: true});
        }

        transaction.update(gameRef, {
            players: players
        });

        } else if (transactionType == "dispense") {
            transaction.update(gameRef, {
                // fundsDispensed: true,
                status: "completed",
                completedAt: currTime
    
            }, {merge: true});
        }
    

    });

    console.log("transaction res: ", transactionRes);

    res.status(200).send("OK");

});

exports.updateExpiredGames = functions.runWith(matchesRunTimeOptions).pubsub.schedule("every 1 minutes").onRun(async (context) => {
    try { 
        const currTime = unixTimestamp();
        const twentyFourHoursAgo = currTime - 24 * 60 * 60;
        const challengeRoomsSnapshot = await db.collectionGroup("challengeRooms")
            .where("status", "in", ["waitingDeposit", "waitingGameResult"])
            .where("createdAt", "<", twentyFourHoursAgo)
            .get();

        const batch = db.batch();

        challengeRoomsSnapshot.docs.forEach((doc) => {
            const challengeRoomRef = doc.ref;
            batch.update(challengeRoomRef, {
                status: "expired",
            });
        });

        await batch.commit();
        
    } catch (error) {
        console.log("error updating expired games: ", error);
    }
});


exports.betGameRetries = functions.runWith(matchesRunTimeOptions).pubsub.schedule("every 1 minutes").onRun(async (context) => {
    try {
        // const gameRef = db.collection("betGames").doc("gameId").collection.(challengeRooms);

        const challengeRoomsSnapshot = await db.collectionGroup("challengeRooms")
            .where("status", "==", "waitingDispense")
            .get();

            // const betGamesChallengeRooms = challengeRoomsSnapshot.docs.filter(doc => doc.ref.path.startsWith('betGames/'));


        await db.runTransaction(async (transaction) => {
            for (const doc of challengeRoomsSnapshot.docs) {
                const challengeRoomData = doc.data();
                console.log("Challenge Room Data: ", challengeRoomData);
                const winner = challengeRoomData.winner;
                // const gameRef = doc.ref.parent.parent; 
                const challengeId = challengeRoomData.id;
                const gameId = challengeRoomData.gameId;

                if (winner === "tie") {
                    const gameChallengeId = createGameChallengeId(gameId, challengeId);
                    const result = cancelGame('signature', gameChallengeId);
                    console.log("tie retry result: ", result);
                } else if (winner) {
                    const gameChallengeId = createGameChallengeId(gameId, challengeId);
                    const winningPlayer = challengeRoomData.players[winner].player;
                    const result = dispense('signature', gameChallengeId, winningPlayer);
                    console.log("win retry result: ", result);
                } else {
                    console.log("null winner", winner);
                }

                transaction.update(doc.ref, {
                    numRetries: admin.firestore.FieldValue.increment(1)
                });

            }
        });
        
    } catch (error) {
        logError({ functionName: "betGameRetries", error });
    }

});


exports.getDepositDeeplink = functions.https.onCall(async (data, context) => {
    const userId = context.auth.uid;
    const betAmount = data.betAmount;
    const gameId = data.gameId;
    const challengeId = data.challengeId;

    const deepLink = await deposit(userId, betAmount, challengeId);

    const gameRef = db.collection("betGames").doc(gameId).collection("challengeRooms").doc(challengeId);

    const transactionRes = await db.runTransaction(async (transaction) => {
        const userRef = gameRef.collection("users").doc(userId);

        transaction.update(gameRef, {
            betAmount: betAmount,
        });

        transaction.update(userRef, {
            depositReceived: false

        }, {merge: true});

    });

    console.log("transaction res: ", transactionRes);

    return { deepLink };

});

exports.dispenseFunds = functions.https.onCall(async (data, context) => {
    const outcome = data.outcome;
    const gameId = data.gameId;
    const challengeId = data.challengeId;
    const winUserId = data.winUserId;

    let walletAddresses = [];

    const gameRef = db.collection("betGames").doc(gameId).collection("challengeRooms").doc(challengeId);
    
    const transactionRes = await db.runTransaction(async (transaction) => {

        if (winUserId !=  null) {
            const winUserRef = gameRef.collection("users").doc(winUserId);
            const winUserSnapshot = await transaction.get(winUserRef);
            const winUserData = winUserSnapshot.data();

            walletAddresses.push(winUserData.walletAddress);
        } else {
            const usersSnapshot = await transaction.get(gameRef.collection("users"));
            usersSnapshot.forEach((userDoc) => {
                const userData = userDoc.data();
                walletAddresses.push(userData.walletAddress);
            });
        }

        transaction.update(gameRef, {
            fundsDispensed: false

        }, {merge: true});

    });

    console.log("transaction res: ", transactionRes);

    const result = dispense(outcome, walletAddresses, "");

    return result;

});


