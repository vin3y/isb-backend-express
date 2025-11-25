const bcrypt = require("bcrypt");
const db = require("../config/db");
const { activityLoggers } = require("../middlewares/activityLogger");

/* ============================================================
   SUPERUSER CHECK
============================================================ */
function requireSuperuser(req, res) {
  if (req.user.role !== "superuser") {
    res.status(403).json({ error: "Only superusers can perform this action." });
    return false;
  }
  return true;
}

/* ============================================================
   GET ALL USERS
============================================================ */
async function getUsers(req, res) {
  if (!requireSuperuser(req, res)) return;

  try {
    const users = await db.query(
      `SELECT id, email, role, created_at, password_updated_at, password_expires_at
       FROM users ORDER BY id ASC`
    );

    // Existing logger
    await activityLoggers.user.logUpdate(req, null, "User List", null, {
      viewed: "all users",
    });

    // NEW – logAction
    await activityLoggers.logAction(req, {
      actionType: "READ",
      entityType: "user",
      entityName: "User List",
      description: "Superuser viewed all users"
    });

    res.json(users.rows);
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/* ============================================================
   GET SINGLE USER
============================================================ */
async function getUser(req, res) {
  if (!requireSuperuser(req, res)) return;

  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT id, email, role, created_at, password_updated_at, password_expires_at
       FROM users WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    // Existing logger
    await activityLoggers.user.logUpdate(
      req,
      id,
      result.rows[0].email,
      null,
      { viewed: true }
    );

    // NEW – logAction
    await activityLoggers.logAction(req, {
      actionType: "READ",
      entityType: "user",
      entityId: id,
      entityName: result.rows[0].email,
      description: "Superuser viewed a user"
    });

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/* ============================================================
   CREATE USER
============================================================ */
async function createUser(req, res) {
  if (!requireSuperuser(req, res)) return;

  const { email, password, role } = req.body;

  if (!email || !password)
    return res.status(400).json({ error: "Email & Password required" });

  try {
    const hashed = await bcrypt.hash(password, 10);

    const result = await db.query(
      `INSERT INTO users (email, password_hash, role, password_expires_at)
       VALUES ($1,$2,$3,$4)
       RETURNING id, email, role`,
      [email, hashed, role || "user", "9999-12-31 23:59:59"]
    );

    // Existing logger
    await activityLoggers.user.logCreate(
      req,
      result.rows[0].id,
      email,
      { email, role }
    );

    // NEW – logAction
    await activityLoggers.logAction(req, {
      actionType: "CREATE",
      entityType: "user",
      entityId: result.rows[0].id,
      entityName: email,
      description: `Superuser created a new user`,
      newData: { email, role }
    });

    res.json({ message: "User created", user: result.rows[0] });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/* ============================================================
   UPDATE USER
============================================================ */
async function updateUser(req, res) {
  if (!requireSuperuser(req, res)) return;

  const { id } = req.params;
  const { email, role } = req.body;

  try {
    await db.query(
      `UPDATE users SET email=$1, role=$2 WHERE id=$3`,
      [email, role, id]
    );

    // Existing logger
    await activityLoggers.user.logUpdate(req, id, email, null, {
      email,
      role,
    });

    // NEW – logAction
    await activityLoggers.logAction(req, {
      actionType: "UPDATE",
      entityType: "user",
      entityId: id,
      entityName: email,
      description: "Superuser updated a user",
      newData: { email, role }
    });

    res.json({ message: "User updated" });
  } catch (error) {
    console.error("Update user error:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/* ============================================================
   DELETE USER
============================================================ */
async function deleteUser(req, res) {
  if (!requireSuperuser(req, res)) return;

  const { id } = req.params;

  try {
    await db.query(`DELETE FROM users WHERE id=$1`, [id]);

    // Existing logger
    await activityLoggers.user.logDelete(
      req,
      id,
      `User ${id}`,
      { deleted: true }
    );

    // NEW – logAction
    await activityLoggers.logAction(req, {
      actionType: "DELETE",
      entityType: "user",
      entityId: id,
      entityName: `User ${id}`,
      description: "Superuser deleted a user"
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({ error: "Server error" });
  }
}

/* ============================================================
   RESET USER PASSWORD
============================================================ */
async function resetUserPassword(req, res) {
  if (!requireSuperuser(req, res)) return;

  const { id } = req.params;
  const { newPassword } = req.body;

  if (!newPassword)
    return res.status(400).json({ error: "New password required" });

  try {
    const hashed = await bcrypt.hash(newPassword, 10);

    await db.query(
      `UPDATE users 
       SET password_hash=$1, password_updated_at=$2, password_expires_at=$3
       WHERE id=$4`,
      [hashed, new Date().toISOString(), "9999-12-31 23:59:59", id]
    );

    // Existing logger
    await activityLoggers.user.logUpdate(
      req,
      id,
      `User ${id}`,
      null,
      { passwordReset: true }
    );

    // NEW – logAction
    await activityLoggers.logAction(req, {
      actionType: "RESET_PASSWORD",
      entityType: "user",
      entityId: id,
      entityName: `User ${id}`,
      description: "Superuser reset a user's password"
    });

    res.json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
};
