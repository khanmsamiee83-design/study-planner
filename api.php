<?php
// ==========================================
// تنظیمات دیتابیس (بعداً موقع آپلود روی هاست، این ۴ خط رو با اطلاعات خودت عوض کن)
// ==========================================
$db_host = "localhost";
$db_name = "نام_دیتابیس_شما";
$db_user = "نام_کاربری_دیتابیس";
$db_pass = "رمز_عبور_دیتابیس";

try {
    $pdo = new PDO("mysql:host=$db_host;dbname=$db_name;charset=utf8mb4", $db_user, $db_pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
} catch (PDOException $e) {
    die(json_encode(['status' => 'error', 'message' => 'خطا در اتصال به دیتابیس']));
}

header('Content-Type: application/json; charset=utf-8');
$action = $_POST['action'] ?? $_GET['action'] ?? '';

// ۱. ثبت‌نام
if ($action == 'signup') {
    $username = strtolower(trim($_POST['username']));
    $password = trim($_POST['password']);
    $name = trim($_POST['name']);
    $user_type = $_POST['user_type'] ?? 'student';
    $avatar = $_POST['avatar'] ?? '1';
    $myCode = strtoupper($username) . '-' . rand(1000, 9999);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+3 days'));

    try {
        $stmt = $pdo->prepare("INSERT INTO users (username, password, name, avatar, user_type, referral_code, subscription_expires) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$username, $password, $name, $avatar, $user_type, $myCode, $expiresAt]);
        echo json_encode(['status' => 'success', 'message' => 'ثبت‌نام موفق']);
    } catch (Exception $e) {
        echo json_encode(['status' => 'error', 'message' => 'نام کاربری تکراری است']);
    }
}

// ۲. ورود
if ($action == 'login') {
    $username = strtolower(trim($_POST['username']));
    $password = trim($_POST['password']);

    $stmt = $pdo->prepare("SELECT * FROM users WHERE username = ? AND password = ?");
    $stmt->execute([$username, $password]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        $today = date('Y-m-d');
        $pdo->prepare("UPDATE users SET last_login_date = ? WHERE id = ?")->execute([$today, $user['id']]);
        
        // ارسال تاریخ انقضا به صورت میلی‌ثانیه برای جاوااسکریپت
        $expiry_date = strtotime($user['subscription_expires']) * 1000; 
        
        // یکپارچه کردن پاسخ سرور (فقط یک بار echo می‌کنیم)
        echo json_encode([
            'status' => 'success', 
            'data' => $user, 
            'expiry_ms' => $expiry_date
        ]);
    } else {
        echo json_encode(['status' => 'error', 'message' => 'نام کاربری یا رمز اشتباه است']);
    }
}

// ۳. جعبه شانس
if ($action == 'open_mystery_box') {
    $user_id = intval($_POST['user_id']);
    $today = date('Y-m-d');

    $stmt = $pdo->prepare("SELECT last_login_date FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();

    if ($user['last_login_date'] == $today) {
        echo json_encode(['status' => 'error', 'message' => 'شما امروز جایزه‌تان را گرفته‌اید!']);
        exit;
    }

    $prize = rand(10, 50);
    $pdo->prepare("UPDATE users SET points_total = points_total + ?, points_spendable = points_spendable + ?, last_login_date = ? WHERE id = ?")->execute([$prize, $prize, $today, $user_id]);

    echo json_encode(['status' => 'success', 'prize_text' => $prize . ' امتیاز', 'new_total' => $prize, 'new_spendable' => $prize]);
}

// ۴. ثبت زمان تایمر
if ($action == 'sync_time') {
    $user_id = intval($_POST['user_id']);
    $lesson_name = $_POST['lesson_name'] ?? 'focus';
    $total_seconds = intval($_POST['total_seconds']);

    $stmt = $pdo->prepare("INSERT INTO lesson_time_logs (user_id, lesson_name, total_seconds) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE total_seconds = ?");
    $stmt->execute([$user_id, $lesson_name, $total_seconds, $total_seconds]);

    $minutes = floor($total_seconds / 60);
    $pdo->prepare("UPDATE users SET points_total = points_total + ?, points_spendable = points_spendable + ? WHERE id = ?")->execute([$minutes, $minutes, $user_id]);

    echo json_encode(['status' => 'success']);
}
    // ۵. دریافت امتیازات آفلاین (Sync)
if ($action == 'sync_offline_points') {
    $user_id = intval($_POST['user_id']);
    $lesson_name = $_POST['lesson_name'] ?? 'offline_study';
    $minutes = intval($_POST['minutes']);
    
    // بررسی اینکه کاربر وجود داره و اشتراکش منقضی نشده باشه
    $stmt = $pdo->prepare("SELECT subscription_expires FROM users WHERE id = ?");
    $stmt->execute([$user_id]);
    $user = $stmt->fetch();
    
    if ($user) {
        // اگر اشتراک منقضی نشده بود، امتیاز رو اضافه کن
        if (strtotime($user['subscription_expires']) > time()) {
            $pdo->prepare("UPDATE users SET points_total = points_total + ?, points_spendable = points_spendable + ? WHERE id = ?")->execute([$minutes, $minutes, $user_id]);
            echo json_encode(['status' => 'success', 'message' => 'امتیازها با موفقیت ثبت شد']);
        } else {
            echo json_encode(['status' => 'error', 'message' => 'اشتراک منقضی شده']);
        }
    } else {
        echo json_encode(['status' => 'error', 'message' => 'کاربر یافت نشد']);
    }
}
?>
