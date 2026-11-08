function createFirebaseLoginHandler({ firebaseAuth, Users, jwt, jwtSecret }) {
  return async function firebaseLogin(req, res) {
    if (!firebaseAuth || !jwtSecret) {
      return res.status(503).json({
        success: false,
        error: "Phone and social sign-in are not configured for this store.",
      });
    }

    const idToken = req.body?.idToken;
    if (typeof idToken !== "string" || !idToken) {
      return res.status(400).json({ success: false, error: "A Firebase sign-in token is required." });
    }

    try {
      const claims = await firebaseAuth.verifyIdToken(idToken, true);
      const uid = String(claims.uid || "");
      const email = claims.email_verified && claims.email
        ? String(claims.email).trim().toLowerCase()
        : "";
      const phone = String(claims.phone_number || "").trim();
      if (!uid || (!email && !phone)) {
        return res.status(401).json({ success: false, error: "The sign-in account has no verified contact method." });
      }

      let user = await Users.findOne({ firebaseUid: uid });
      if (!user && email) user = await Users.findOne({ email });
      if (!user && phone) user = await Users.findOne({ phone });

      if (user) {
        if (user.firebaseUid && user.firebaseUid !== uid) {
          return res.status(409).json({
            success: false,
            error: "This account is already linked to a different sign-in identity.",
          });
        }
        user.firebaseUid = uid;
        if (!user.email && email) user.email = email;
        if (!user.phone && phone) user.phone = phone;
        if (!user.name && claims.name) user.name = String(claims.name).slice(0, 120);
        await user.save();
      } else {
        user = await Users.create({
          firebaseUid: uid,
          email: email || undefined,
          phone: phone || undefined,
          name: String(claims.name || "Customer").slice(0, 120),
          cartData: {},
        });
      }

      const token = jwt.sign({ user: { id: user._id } }, jwtSecret, { expiresIn: "7d" });
      return res.json({ success: true, token });
    } catch (error) {
      if (error?.code === 11000) {
        return res.status(409).json({
          success: false,
          error: "That email or phone number is already connected to another account.",
        });
      }
      if (error?.name === "FirebaseAuthError" || error?.code === "auth/id-token-revoked") {
        return res.status(401).json({ success: false, error: "The sign-in session is invalid or expired." });
      }
      console.error("Firebase identity sign-in failed:", error);
      return res.status(500).json({ success: false, error: "Unable to complete sign-in right now." });
    }
  };
}

module.exports = { createFirebaseLoginHandler };
