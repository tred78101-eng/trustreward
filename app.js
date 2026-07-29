/* =====================================================
   TRUSTREWARD - COMPLETE APP.JS
   Firebase Auth + Realtime Database
===================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  get,
  update,
  push,
  query,
  orderByChild,
  equalTo,
  onValue
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";


/* =====================================================
   FIREBASE CONFIG
   >>> REPLACE THE API KEY BELOW WITH YOUR REAL ONE <<<
   Get it from: Firebase Console > Project Settings > General > Web API Key
   It looks like: AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
===================================================== */

const firebaseConfig = {

  apiKey: "AIzaSyCzZIrEyMnuvDPPqXl6m1ODxacEFfKyWxI",

  authDomain:
    "trustreward-19165.firebaseapp.com",

  databaseURL:
    "https://trustreward-19165-default-rtdb.firebaseio.com",

  projectId:
    "trustreward-19165",

  storageBucket:
    "trustreward-19165.firebasestorage.app",

  messagingSenderId:
    "156070844909",

  appId:
    "1:156070844909:web:8625342638350641ffafe4"
};


/* =====================================================
   INITIALIZE
===================================================== */

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const db = getDatabase(app);


/* =====================================================
   GLOBAL VARIABLES
===================================================== */

let currentUser = null;

let currentUserData = null;

let currentPage = "home";

let previousPage = "home";

let userListenerStarted = false;


/* =====================================================
   SHORT SELECTOR
===================================================== */

function $(id) {

  return document.getElementById(id);

}


/* =====================================================
   REFERRAL CODE
===================================================== */

function createReferralCode(uid) {

  return "TR" +
    uid.substring(0, 6).toUpperCase();

}


/* =====================================================
   LOADING SCREEN
===================================================== */

function hideLoading() {

  $("screen-loading")?.classList.add("hidden");

}


/* =====================================================
   AUTH SCREEN
===================================================== */

function showAuthScreen() {

  hideLoading();

  $("screen-auth")?.classList.remove("hidden");

  $("screen-app")?.classList.add("hidden");

}


/* =====================================================
   APP SCREEN
===================================================== */

function showAppScreen() {

  hideLoading();

  $("screen-auth")?.classList.add("hidden");

  $("screen-app")?.classList.remove("hidden");

}


/* =====================================================
   AUTH STATE
===================================================== */

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    currentUser = null;

    currentUserData = null;

    userListenerStarted = false;

    showAuthScreen();

    showAuth("login");

    return;

  }


  currentUser = user;


  try {

    await loadUserData(user.uid);

  } catch (error) {

    console.error(
      "LOAD USER ERROR:",
      error
    );

  }


  showAppScreen();

  updateUserInterface();

  showPage("home");

  startUserListener();

});


/* =====================================================
   AUTH PAGE SWITCH
===================================================== */

window.showAuth = function(page) {

  document
    .querySelectorAll(".auth-page")
    .forEach((element) => {

      element.classList.add("hidden");

    });


  const pageElement =
    $("auth-" + page);

  if (pageElement) {

    pageElement.classList.remove("hidden");

  }

};


/* =====================================================
   PASSWORD SHOW / HIDE
===================================================== */

window.togglePw = function(
  inputId,
  button
) {

  const input = $(inputId);

  if (!input) return;


  if (input.type === "password") {

    input.type = "text";

    button.innerHTML =
      '<i class="fa-solid fa-eye-slash"></i>';

  } else {

    input.type = "password";

    button.innerHTML =
      '<i class="fa-solid fa-eye"></i>';

  }

};


/* =====================================================
   SIGN UP
===================================================== */

window.handleSignup = async function() {

  const name =
    $("signup-name")?.value.trim();

  const email =
    $("signup-email")?.value.trim();

  const password =
    $("signup-password")?.value || "";

  const referralInput =
    $("signup-referral")?.value
      .trim()
      .toUpperCase();

  const errorBox =
    $("signup-error");

  const button =
    $("btn-signup");


  errorBox?.classList.add("hidden");


  if (!name) {

    showError(
      errorBox,
      "Please enter your full name."
    );

    return;

  }


  if (!email) {

    showError(
      errorBox,
      "Please enter your email address."
    );

    return;

  }


  if (
    password.length < 8 ||
    !/[A-Z]/.test(password) ||
    !/[a-z]/.test(password) ||
    !/[0-9]/.test(password) ||
    !/[^A-Za-z0-9]/.test(password)
  ) {

    showError(
      errorBox,
      "Password must contain at least 8 characters, uppercase, lowercase, number and symbol."
    );

    return;

  }


  if (button) {

    button.disabled = true;

    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Creating Account...';

  }


  try {

    const result =
      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );


    const user =
      result.user;


    currentUser =
      user;


    await updateProfile(
      user,
      {
        displayName: name
      }
    );


    let referrerUid = "";


    if (referralInput) {

      try {

        const referralQuery = query(
          ref(db, "users"),
          orderByChild("referralCode"),
          equalTo(referralInput)
        );


        const snapshot =
          await get(referralQuery);


        if (snapshot.exists()) {

          snapshot.forEach((child) => {

            referrerUid =
              child.key;

          });

        }

      } catch (error) {

        console.error(
          "REFERRAL LOOKUP ERROR:",
          error
        );

      }

    }


    const userData = {

      uid: user.uid,

      user_id: user.uid,

      email: user.email || "",

      displayName: name,

      photoURL: "",

      coins: 0,

      totalEarned: 0,

      referralCount: 0,

      referralCode:
        createReferralCode(user.uid),

      referredBy:
        referrerUid,

      createdAt:
        Date.now(),

      status:
        "active"

    };


    await set(
      ref(db, "users/" + user.uid),
      userData
    );


    currentUserData =
      userData;


    if (
      referrerUid &&
      referrerUid !== user.uid
    ) {

      const referrerRef =
        ref(db, "users/" + referrerUid);


      const referrerSnapshot =
        await get(referrerRef);


      if (referrerSnapshot.exists()) {

        const referrerData =
          referrerSnapshot.val() || {};


        const bonus = 500;


        await update(
          referrerRef,
          {

            coins:
              Number(referrerData.coins || 0)
              + bonus,

            totalEarned:
              Number(referrerData.totalEarned || 0)
              + bonus,

            referralCount:
              Number(referrerData.referralCount || 0)
              + 1

          }
        );


        await push(
          ref(
            db,
            "notifications/" +
            referrerUid
          ),
          {

            type: "success",

            title:
              "ðŸŽ‰ New Referral!",

            message:
              name +
              " joined using your referral code. You earned " +
              bonus +
              " coins!",

            read: false,

            timestamp:
              Date.now()

          }
        );

      }

    }


    showAppScreen();

    updateUserInterface();

    showPage("home");

    showToast(
      "Account created successfully!"
    );


  } catch (error) {

    console.error(
      "SIGNUP ERROR:",
      error
    );

    showError(
      errorBox,
      getFirebaseError(error)
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.innerHTML =
        '<i class="fa-solid fa-user-plus"></i> Create Account';

    }

  }

};


/* =====================================================
   LOGIN
===================================================== */

window.handleLogin = async function() {

  const email =
    $("login-email")?.value.trim();

  const password =
    $("login-password")?.value || "";

  const errorBox =
    $("login-error");

  const button =
    $("btn-login");


  errorBox?.classList.add("hidden");


  if (!email || !password) {

    showError(
      errorBox,
      "Please enter your email and password."
    );

    return;

  }


  if (button) {

    button.disabled = true;

    button.innerHTML =
      '<i class="fa-solid fa-spinner fa-spin"></i> Signing In...';

  }


  try {

    const result =
      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );


    currentUser =
      result.user;


    await loadUserData(
      currentUser.uid
    );


    showAppScreen();

    updateUserInterface();

    showPage("home");

    showToast(
      "Welcome back!"
    );


  } catch (error) {

    console.error(
      "LOGIN ERROR:",
      error
    );

    showError(
      errorBox,
      getFirebaseError(error)
    );


  } finally {

    if (button) {

      button.disabled = false;

      button.innerHTML =
        '<i class="fa-solid fa-right-to-bracket"></i> Sign In';

    }

  }

};


/* =====================================================
   FORGOT PASSWORD
===================================================== */

window.handleForgotPassword =
async function() {

  const email =
    $("forgot-email")?.value.trim();

  const errorBox =
    $("forgot-error");

  const successBox =
    $("forgot-success");


  errorBox?.classList.add("hidden");

  successBox?.classList.add("hidden");


  if (!email) {

    showError(
      errorBox,
      "Please enter your email address."
    );

    return;

  }


  try {

    await sendPasswordResetEmail(
      auth,
      email
    );


    if (successBox) {

      successBox.textContent =
        "Password reset email sent. Check your inbox.";

      successBox.classList.remove(
        "hidden"
      );

    }


  } catch (error) {

    showError(
      errorBox,
      getFirebaseError(error)
    );

  }

};


/* =====================================================
   LOGOUT
===================================================== */

window.handleLogout =
async function() {

  try {

    await signOut(auth);

    currentUser = null;

    currentUserData = null;

    userListenerStarted = false;

  } catch (error) {

    console.error(
      "LOGOUT ERROR:",
      error
    );

  }

};


/* =====================================================
   LOAD USER DATA
===================================================== */

async function loadUserData(uid) {

  const userRef =
    ref(db, "users/" + uid);


  const snapshot =
    await get(userRef);


  if (snapshot.exists()) {

    const oldData =
      snapshot.val() || {};


    const fixedData = {

      ...oldData,

      uid: uid,

      user_id:
        oldData.user_id ||
        oldData.uid ||
        uid,

      email:
        oldData.email ||
        currentUser?.email ||
        "",

      displayName:
        oldData.displayName ||
        oldData.name ||
        currentUser?.displayName ||
        "User",

      photoURL:
        oldData.photoURL ||
        "",

      coins:
        Number(oldData.coins ?? 0),

      totalEarned:
        Number(oldData.totalEarned ?? 0),

      referralCount:
        Number(oldData.referralCount ?? 0),

      referralCode:
        oldData.referralCode ||
        createReferralCode(uid),

      referredBy:
        oldData.referredBy ||
        "",

      status:
        oldData.status ||
        "active"

    };


    currentUserData =
      fixedData;


    await update(
      userRef,
      {

        uid: uid,

        user_id:
          uid,

        email:
          fixedData.email,

        displayName:
          fixedData.displayName,

        photoURL:
          fixedData.photoURL,

        coins:
          fixedData.coins,

        totalEarned:
          fixedData.totalEarned,

        referralCount:
          fixedData.referralCount,

        referralCode:
          fixedData.referralCode,

        referredBy:
          fixedData.referredBy,

        status:
          fixedData.status

      }
    );


    return;

  }


  const newUserData = {

    uid: uid,

    user_id: uid,

    email:
      currentUser?.email || "",

    displayName:
      currentUser?.displayName ||
      "User",

    photoURL: "",

    coins: 0,

    totalEarned: 0,

    referralCount: 0,

    referralCode:
      createReferralCode(uid),

    referredBy: "",

    createdAt:
      Date.now(),

    status:
      "active"

  };


  await set(
    userRef,
    newUserData
  );


  currentUserData =
    newUserData;

}


/* =====================================================
   UPDATE USER UI
===================================================== */

function updateUserInterface() {

  if (!currentUser) return;


  const name =
    currentUserData?.displayName ||
    currentUserData?.name ||
    currentUser.displayName ||
    "User";


  const email =
    currentUserData?.email ||
    currentUser.email ||
    "";


  const coins =
    Number(
      currentUserData?.coins || 0
    );


  const totalEarned =
    Number(
      currentUserData?.totalEarned || 0
    );


  const referrals =
    Number(
      currentUserData?.referralCount || 0
    );


  const userId =
    currentUserData?.user_id ||
    currentUserData?.uid ||
    currentUser.uid;


  /* HOME */

  if ($("home-welcome")) {

    $("home-welcome").textContent =
      getTimeGreeting() +
      ", " +
      name;

  }


  if ($("home-coins")) {

    $("home-coins").textContent =
      coins.toLocaleString();

  }


  if ($("home-total-earned")) {

    $("home-total-earned").textContent =
      totalEarned.toLocaleString();

  }


  if ($("home-referrals")) {

    $("home-referrals").textContent =
      referrals.toLocaleString();

  }


  /* USER ID */

  if ($("home-user-id")) {

    $("home-user-id").textContent =
      userId;

  }


  /* SETTINGS */

  if ($("settings-name")) {

    $("settings-name").textContent =
      name;

  }


  if ($("settings-email")) {

    $("settings-email").textContent =
      email;

  }


  if ($("ep-name")) {

    $("ep-name").value =
      name;

  }


  if ($("ep-email")) {

    $("ep-email").value =
      email;

  }


  if ($("ep-status")) {

    $("ep-status").textContent =
      currentUserData?.status ||
      "Active";

  }


  /* WITHDRAWAL */

  if ($("wd-coins")) {

    $("wd-coins").textContent =
      coins.toLocaleString();

  }


  /* REFERRAL */

  if ($("referral-code-display")) {

    $("referral-code-display").textContent =
      currentUserData?.referralCode ||
      "â€”";

  }


  /* PHOTO */

  const photo =
    currentUserData?.photoURL ||
    "";


  if (photo) {

    $("settings-avatar")
      ?.setAttribute(
        "src",
        photo
      );

    $("ep-avatar")
      ?.setAttribute(
        "src",
        photo
      );

  }

}


/* =====================================================
   COPY USER ID
===================================================== */

window.copyUserId =
async function() {

  if (!currentUser) {

    showToast(
      "Please log in first."
    );

    return;

  }


  const userId =
    currentUser.uid;


  try {

    await navigator.clipboard.writeText(
      userId
    );

    showToast(
      "User ID copied!"
    );

  } catch (error) {

    const textarea =
      document.createElement(
        "textarea"
      );

    textarea.value =
      userId;

    document.body.appendChild(
      textarea
    );

    textarea.select();

    document.execCommand(
      "copy"
    );

    textarea.remove();

    showToast(
      "User ID copied!"
    );

  }

};


/* =====================================================
   PAGE NAVIGATION
===================================================== */

window.showPage =
function(page) {

  previousPage =
    currentPage;

  currentPage =
    page;


  document
    .querySelectorAll(
      ".main-page, .subpage"
    )
    .forEach(
      (element) => {

        element.classList.add(
          "hidden"
        );

      }
    );


  const pageElement =
    $("page-" + page);


  if (pageElement) {

    pageElement.classList.remove(
      "hidden"
    );

  }


  document
    .querySelectorAll(
      ".nav-item"
    )
    .forEach(
      (button) => {

        button.classList.remove(
          "active"
        );


        if (
          button.dataset.page ===
          page
        ) {

          button.classList.add(
            "active"
          );

        }

      }
    );


  updateHeader(page);


  if (
    page === "leaderboard"
  ) {

    loadLeaderboard();

  }


  if (
    page === "notifications"
  ) {

    loadNotifications();

  }


  updateUserInterface();

};


/* =====================================================
   SUBPAGE
===================================================== */

window.showSubpage =
function(page) {

  previousPage =
    currentPage;

  currentPage =
    page;


  document
    .querySelectorAll(
      ".main-page, .subpage"
    )
    .forEach(
      (element) => {

        element.classList.add(
          "hidden"
        );

      }
    );


  const element =
    $("page-" + page);


  if (element) {

    element.classList.remove(
      "hidden"
    );

  }


  updateHeader(page);

  updateUserInterface();

};


/* =====================================================
   BACK
===================================================== */

window.goBack =
function() {

  showPage(
    previousPage ||
    "home"
  );

};


/* =====================================================
   HEADER
===================================================== */

function updateHeader(page) {

  const back =
    $("header-back");

  const logo =
    $("header-logo");

  const title =
    $("header-title");


  const mainPages = [

    "home",

    "leaderboard",

    "notifications",

    "settings"

  ];


  if (
    mainPages.includes(page)
  ) {

    back?.classList.add(
      "hidden"
    );

    logo?.classList.remove(
      "hidden"
    );

    title?.classList.add(
      "hidden"
    );

    return;

  }


  back?.classList.remove(
    "hidden"
  );

  logo?.classList.add(
    "hidden"
  );

  title?.classList.remove(
    "hidden"
  );


  const titles = {

    referral:
      "Refer & Earn",

    withdrawal:
      "Withdrawal",

    "edit-profile":
      "Edit Profile",

    rules:
      "TrustReward Rules",

    privacy:
      "Privacy Policy",

    terms:
      "Terms & Conditions",

    help:
      "Help Center",

    about:
      "About TrustReward"

  };


  if (title) {

    title.textContent =
      titles[page] ||
      page;

  }

}


/* =====================================================
   LEADERBOARD
===================================================== */

async function loadLeaderboard() {

  const container =
    $("leaderboard-list");


  if (!container) return;


  container.innerHTML = `

    <div class="loading-box">

      <i class="fa-solid fa-spinner fa-spin"></i>

      <p>
        Loading leaderboard...
      </p>

    </div>

  `;


  try {

    const snapshot =
      await get(
        ref(db, "users")
      );


    if (!snapshot.exists()) {

      container.innerHTML = `

        <div class="empty-state">

          <i class="fa-solid fa-trophy"></i>

          <h3>
            No Users Yet
          </h3>

          <p>
            The leaderboard will appear when users start earning.
          </p>

        </div>

      `;

      return;

    }


    const users = [];


    snapshot.forEach(
      (child) => {

        const data =
          child.val() || {};


        users.push({

          uid:
            child.key,

          name:
            data.displayName ||
            data.name ||
            "User",

          coins:
            Number(
              data.totalEarned ??
              data.coins ??
              0
            ),

          photoURL:
            data.photoURL ||
            ""

        });

      }
    );


    users.sort(
      (a, b) =>
        b.coins -
        a.coins
    );


    const topUsers =
      users.slice(
        0,
        20
      );


    if (!topUsers.length) {

      container.innerHTML = `

        <div class="empty-state">

          <i class="fa-solid fa-trophy"></i>

          <h3>
            No Rankings Yet
          </h3>

        </div>

      `;

      return;

    }


    container.innerHTML =
      topUsers
        .map(
          (user, index) => {

            const rank =
              index + 1;


            const avatar =
              user.photoURL ||
              "https://ui-avatars.com/api/?name=" +
              encodeURIComponent(
                user.name
              );


            return `

              <div class="leaderboard-item">

                <div class="leaderboard-rank">

                  #${rank}

                </div>


                <img
                  src="${escapeHtml(avatar)}"
                  alt="Profile"
                  class="leaderboard-avatar"
                >


                <div class="leaderboard-user">

                  <strong>
                    ${escapeHtml(user.name)}
                  </strong>

                  <span>
                    ${user.coins.toLocaleString()} coins
                  </span>

                </div>


                <i class="fa-solid fa-trophy"></i>

              </div>

            `;

          }
        )
        .join("");


  } catch (error) {

    console.error(
      "LEADERBOARD ERROR:",
      error
    );


    container.innerHTML = `

      <div class="empty-state">

        <i class="fa-solid fa-triangle-exclamation"></i>

        <h3>
          Leaderboard unavailable
        </h3>

        <p>
          ${escapeHtml(
            getFirebaseError(error)
          )}
        </p>

      </div>

    `;

  }

}


/* =====================================================
   NOTIFICATIONS
===================================================== */

function loadNotifications() {

  if (!currentUser) return;


  const container =
    $("notifications-list");


  if (!container) return;


  container.innerHTML = `

    <div class="loading-box">

      <i class="fa-solid fa-spinner fa-spin"></i>

      <p>
        Loading notifications...
      </p>

    </div>

  `;


  const notificationsRef =
    ref(
      db,
      "notifications/" +
      currentUser.uid
    );


  onValue(
    notificationsRef,
    (snapshot) => {

      if (!snapshot.exists()) {

        container.innerHTML = `

          <div class="empty-state">

            <i class="fa-regular fa-bell-slash"></i>

            <h3>
              No Notifications
            </h3>

            <p>
              You are all caught up.
            </p>

          </div>

        `;

        return;

      }


      const list = [];


      snapshot.forEach(
        (child) => {

          list.push({

            key:
              child.key,

            ...(child.val() || {})

          });

        }
      );


      list.sort(
        (a, b) =>
          Number(b.timestamp || 0) -
          Number(a.timestamp || 0)
      );


      container.innerHTML =
        list
          .map(
            (notification) => {

              return `

                <div class="notification-item">

                  <div class="notification-icon">

                    <i class="fa-solid fa-bell"></i>

                  </div>


                  <div>

                    <strong>
                      ${escapeHtml(
                        notification.title ||
                        "Notification"
                      )}
                    </strong>


                    <p>
                      ${escapeHtml(
                        notification.message ||
                        ""
                      )}
                    </p>


                    <small>
                      ${escapeHtml(
                        formatDate(
                          notification.timestamp
                        )
                      )}
                    </small>

                  </div>

                </div>

              `;

            }
          )
          .join("");

    },
    (error) => {

      console.error(
        "NOTIFICATION ERROR:",
        error
      );


      container.innerHTML = `

        <div class="empty-state">

          <h3>
            Unable to load notifications
          </h3>

          <p>
            ${escapeHtml(
              getFirebaseError(error)
            )}
          </p>

        </div>

      `;

    }
  );

}


/* =====================================================
   SUPPORT / HELP CENTER
===================================================== */

window.sendSupportMessage =
async function() {

  if (!currentUser) {

    showToast(
      "Please log in first."
    );

    return;

  }


  const subject =
    $("support-subject")
      ?.value
      .trim();


  const message =
    $("support-message")
      ?.value
      .trim();


  const errorBox =
    $("support-error");


  const successBox =
    $("support-success");


  errorBox?.classList.add(
    "hidden"
  );

  successBox?.classList.add(
    "hidden"
  );


  if (!subject) {

    showError(
      errorBox,
      "Please enter a subject."
    );

    return;

  }


  if (!message) {

    showError(
      errorBox,
      "Please write your message."
    );

    return;

  }


  if (message.length < 5) {

    showError(
      errorBox,
      "Please write a little more detail."
    );

    return;

  }


  try {

    const supportRef =
      push(
        ref(
          db,
          "supportMessages"
        )
      );


    await set(
      supportRef,
      {

        uid:
          currentUser.uid,

        user_id:
          currentUser.uid,

        email:
          currentUser.email || "",

        displayName:
          currentUserData?.displayName ||
          currentUser.displayName ||
          "User",

        subject:
          subject,

        message:
          message,

        status:
          "unread",

        createdAt:
          Date.now()

      }
    );


    if (successBox) {

      successBox.textContent =
        "Message sent successfully. Support will review your message.";

      successBox.classList.remove(
        "hidden"
      );

    }


    if ($("support-subject")) {

      $("support-subject").value =
        "";

    }


    if ($("support-message")) {

      $("support-message").value =
        "";

    }


    showToast(
      "Message sent to Support!"
    );


  } catch (error) {

    console.error(
      "SUPPORT ERROR:",
      error
    );


    showError(
      errorBox,
      "Message could not be sent. Check your Firebase Database Rules."
    );

  }

};


/* =====================================================
   PROFILE
===================================================== */

window.saveProfile =
async function() {

  if (!currentUser) return;


  const name =
    $("ep-name")
      ?.value
      .trim();


  const errorBox =
    $("ep-error");


  errorBox?.classList.add(
    "hidden"
  );


  if (!name) {

    showError(
      errorBox,
      "Please enter your name."
    );

    return;

  }


  try {

    await updateProfile(
      currentUser,
      {
        displayName:
          name
      }
    );


    await update(
      ref(
        db,
        "users/" +
        currentUser.uid
      ),
      {

        displayName:
          name,

        email:
          currentUser.email || "",

        uid:
          currentUser.uid,

        user_id:
          currentUser.uid

      }
    );


    currentUserData.displayName =
      name;


    updateUserInterface();


    showToast(
      "Profile updated!"
    );


  } catch (error) {

    console.error(
      "PROFILE ERROR:",
      error
    );


    showError(
      errorBox,
      "Could not update profile."
    );

  }

};


/* =====================================================
   PHOTO UPLOAD
===================================================== */

window.triggerPhotoUpload =
function() {

  $("photo-input")?.click();

};


window.handlePhotoUpload =
function(input) {

  const file =
    input.files?.[0];


  if (
    !file ||
    !currentUser
  ) {

    return;

  }


  if (
    file.size >
    2 * 1024 * 1024
  ) {

    showToast(
      "Please choose an image smaller than 2 MB."
    );

    input.value =
      "";

    return;

  }


  const reader =
    new FileReader();


  reader.onload =
    async function(event) {

      try {

        const image =
          event.target.result;


        await update(
          ref(
            db,
            "users/" +
            currentUser.uid
          ),
          {

            photoURL:
              image

          }
        );


        currentUserData.photoURL =
          image;


        $("ep-avatar")
          ?.setAttribute(
            "src",
            image
          );


        $("settings-avatar")
          ?.setAttribute(
            "src",
            image
          );


        showToast(
          "Profile photo saved!"
        );


      } catch (error) {

        console.error(
          "PHOTO ERROR:",
          error
        );


        showToast(
          "Could not save profile photo."
        );

      }

    };


  reader.readAsDataURL(file);

};


/* =====================================================
   WITHDRAWALS
===================================================== */

window.submitWithdrawal =
async function(type) {

  if (!currentUser) {

    showToast(
      "Please sign in first."
    );

    return;

  }


  const errorBox =
    type === "bank"
      ? $("bank-error")
      : $("airtime-error");


  errorBox?.classList.add(
    "hidden"
  );


  const currentCoins =
    Number(
      currentUserData?.coins ||
      0
    );


  if (type === "bank") {

    const coins =
      Number(
        $("bank-coins")
          ?.value ||
        0
      );


    if (coins < 2000) {

      showError(
        errorBox,
        "Minimum bank withdrawal is 2,000 coins."
      );

      return;

    }


    if (coins > currentCoins) {

      showError(
        errorBox,
        "You do not have enough coins."
      );

      return;

    }


    const country =
      $("bank-country")
        ?.value
        .trim();


    const bankName =
      $("bank-name")
        ?.value
        .trim();


    const accountNumber =
      $("bank-acct")
        ?.value
        .trim();


    const accountName =
      $("bank-acct-name")
        ?.value
        .trim();


    if (
      !country ||
      !bankName ||
      !accountNumber ||
      !accountName
    ) {

      showError(
        errorBox,
        "Please complete all bank details."
      );

      return;

    }


    try {

      const withdrawalRef =
        push(
          ref(
            db,
            "withdrawals"
          )
        );


      await set(
        withdrawalRef,
        {

          uid:
            currentUser.uid,

          user_id:
            currentUser.uid,

          email:
            currentUser.email || "",

          displayName:
            currentUserData?.displayName ||
            "User",

          type:
            "bank",

          country:
            country,

          bankName:
            bankName,

          accountNumber:
            accountNumber,

          accountName:
            accountName,

          coins:
            coins,

          status:
            "pending",

          createdAt:
            Date.now()

        }
      );


      const newCoins =
        currentCoins -
        coins;


      await update(
        ref(
          db,
          "users/" +
          currentUser.uid
        ),
        {

          coins:
            newCoins

        }
      );


      currentUserData.coins =
        newCoins;


      updateUserInterface();


      showToast(
        "Bank withdrawal submitted successfully!"
      );


    } catch (error) {

      console.error(
        "BANK WITHDRAWAL ERROR:",
        error
      );


      showError(
        errorBox,
        "Withdrawal failed. Please try again."
      );

    }


    return;

  }


  if (type === "airtime") {

    const country =
      $("airtime-country")
        ?.value
        .trim();


    const phone =
      $("airtime-phone")
        ?.value
        .trim();


    const coins =
      400;


    if (!country) {

      showError(
        errorBox,
        "Please enter your country."
      );

      return;

    }


    if (!phone) {

      showError(
        errorBox,
        "Please enter your phone number."
      );

      return;

    }


    if (currentCoins < coins) {

      showError(
        errorBox,
        "You need at least 400 coins for airtime."
      );

      return;

    }


    try {

      const withdrawalRef =
        push(
          ref(
            db,
            "withdrawals"
          )
        );


      await set(
        withdrawalRef,
        {

          uid:
            currentUser.uid,

          user_id:
            currentUser.uid,

          email:
            currentUser.email || "",

          displayName:
            currentUserData?.displayName ||
            "User",

          type:
            "airtime",

          country:
            country,

          phone:
            phone,

          coins:
            coins,

          reward:
            "â‚¦500 Airtime",

          status:
            "pending",

          createdAt:
            Date.now()

        }
      );


      const newCoins =
        currentCoins -
        coins;


      await update(
        ref(
          db,
          "users/" +
          currentUser.uid
        ),
        {

          coins:
            newCoins

        }
      );


      currentUserData.coins =
        newCoins;


      updateUserInterface();


      showToast(
        "Airtime request submitted successfully!"
      );


    } catch (error) {

      console.error(
        "AIRTIME ERROR:",
        error
      );


      showError(
        errorBox,
        "Airtime request failed. Please try again."
      );

    }

  }

};


/* =====================================================
   COPY REFERRAL
===================================================== */

window.copyReferral =
async function() {

  const code =
    currentUserData?.referralCode;


  if (!code) {

    showToast(
      "Referral code unavailable."
    );

    return;

  }


  try {

    await navigator.clipboard.writeText(
      code
    );


    showToast(
      "Referral code copied!"
    );


  } catch {

    showToast(
      "Could not copy referral code."
    );

  }

};


/* =====================================================
   SHARE REFERRAL
===================================================== */

window.shareReferral =
async function() {

  const code =
    currentUserData?.referralCode;


  if (!code) {

    showToast(
      "Referral code unavailable."
    );

    return;

  }


  const url =
    window.location.origin +
    window.location.pathname +
    "?ref=" +
    encodeURIComponent(code);


  try {

    if (
      navigator.share
    ) {

      await navigator.share({

        title:
          "Join TrustReward",

        text:
          "Join TrustReward and earn rewards with me!",

        url:
          url

      });

    } else {

      await navigator.clipboard.writeText(
        url
      );

      showToast(
        "Referral link copied!"
      );

    }

  } catch {

    /* User cancelled share */

  }

};


/* =====================================================
   THEME
===================================================== */

window.toggleTheme =
function(isDark) {

  const theme =
    isDark
      ? "dark"
      : "light";


  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );


  localStorage.setItem(
    "trustreward-theme",
    theme
  );

};


function loadTheme() {

  const theme =
    localStorage.getItem(
      "trustreward-theme"
    ) ||
    "dark";


  document.documentElement
    .setAttribute(
      "data-theme",
      theme
    );


  const toggle =
    $("theme-toggle");


  if (toggle) {

    toggle.checked =
      theme === "dark";

  }

}


/* =====================================================
   REALTIME USER DATA
===================================================== */

function startUserListener() {

  if (
    !currentUser ||
    userListenerStarted
  ) {

    return;

  }


  userListenerStarted =
    true;


  const userRef =
    ref(
      db,
      "users/" +
      currentUser.uid
    );


  onValue(
    userRef,
    (snapshot) => {

      if (!snapshot.exists()) {

        return;

      }


      currentUserData = {

        ...currentUserData,

        ...(snapshot.val() || {})

      };


      updateUserInterface();

    },
    (error) => {

      console.error(
        "USER LISTENER ERROR:",
        error
      );

    }
  );

}


/* =====================================================
   TIME GREETING
===================================================== */

function getTimeGreeting() {

  const hour =
    new Date().getHours();


  if (
    hour >= 5 &&
    hour < 12
  ) {

    return "Good morning";

  }


  if (
    hour >= 12 &&
    hour < 18
  ) {

    return "Good afternoon";

  }


  return "Good evening";

}


/* =====================================================
   ERROR MESSAGE
===================================================== */

function showError(
  element,
  message
) {

  if (!element) return;


  element.textContent =
    message;


  element.classList.remove(
    "hidden"
  );

}


/* =====================================================
   TOAST
===================================================== */

function showToast(message) {

  const toast =
    $("toast");


  if (!toast) return;


  toast.textContent =
    message;


  toast.classList.remove(
    "hidden"
  );


  clearTimeout(
    window.__trustRewardToast
  );


  window.__trustRewardToast =
    setTimeout(
      () => {

        toast.classList.add(
          "hidden"
        );

      },
      3500
    );

}


/* =====================================================
   DATE
===================================================== */

function formatDate(timestamp) {

  if (!timestamp) {

    return "";

  }


  return new Date(
    timestamp
  ).toLocaleString();

}


/* =====================================================
   ESCAPE HTML
===================================================== */

function escapeHtml(value) {

  return String(
    value ?? ""
  )

    .replaceAll(
      "&",
      "&amp;"
    )

    .replaceAll(
      "<",
      "&lt;"
    )

    .replaceAll(
      ">",
      "&gt;"
    )

    .replaceAll(
      '"',
      "&quot;"
    )

    .replaceAll(
      "'",
      "&#039;"
    );

}


/* =====================================================
   FIREBASE ERROR
===================================================== */

function getFirebaseError(
  error
) {

  const code =
    error?.code ||
    "";


  if (
    code.includes(
      "email-already-in-use"
    )
  ) {

    return "This email is already registered.";

  }


  if (
    code.includes(
      "invalid-credential"
    ) ||
    code.includes(
      "wrong-password"
    )
  ) {

    return "Incorrect email or password.";

  }


  if (
    code.includes(
      "user-not-found"
    )
  ) {

    return "No account found with this email.";

  }


  if (
    code.includes(
      "weak-password"
    )
  ) {

    return "Password is too weak.";

  }


  if (
    code.includes(
      "invalid-email"
    )
  ) {

    return "Please enter a valid email address.";

  }


  if (
    code.includes(
      "too-many-requests"
    )
  ) {

    return "Too many attempts. Try again later.";

  }


  if (
    code.includes(
      "network-request-failed"
    )
  ) {

    return "Network error. Check your internet connection.";

  }


  if (
    code.includes(
      "permission-denied"
    )
  ) {

    return "Firebase permission denied. Check your Realtime Database Rules.";

  }


  return (
    error?.message ||
    "Something went wrong."
  );

}


/* =====================================================
   START APP
===================================================== */

loadTheme();

showAuth("login");