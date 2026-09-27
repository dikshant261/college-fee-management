# College Fee Management System: Installation & Multi-Device Setup Guide

This guide provides complete, step-by-step instructions for installing the College Fee Management System, accessing it from multiple devices (phones, tablets, and computers) over local Wi-Fi, and migrating the app to another device without data loss.

---

## Table of Contents
1. [How the System Works (Architecture)](#1-how-the-system-works-architecture)
2. [Step-by-Step: Installing on the Host Computer](#2-step-by-step-installing-on-the-host-computer)
3. [Step-by-Step: Accessing from Other Devices (Phones / Laptops)](#3-step-by-step-accessing-from-other-devices-phones--laptops)
4. [Step-by-Step: Moving the App to a New Device](#4-step-by-step-moving-the-app-to-a-new-device)
5. [Troubleshooting: "This Site Can't Be Reached"](#5-troubleshooting-this-site-cant-be-reached)

---

## 1. How the System Works (Architecture)

* **Host Computer (Server):** 
  The primary computer where `CollegeFeeManagement-Setup.exe` is installed. It runs the backend database and serves the web application on **Port 5000**.
* **Client Devices (Phones, Tablets, Other PCs):**
  Any device connected to the **same Wi-Fi router**. These devices **do not need to install anything**—they simply open the Host's IP address (e.g., `http://192.168.1.15:5000`) in Google Chrome, Safari, Edge, etc.
* **Database & Uploads Safety:**
  All records (`college.db`) and uploaded files (photos, receipts, QR codes) are stored in `C:\CollegeData`. This folder is permanently preserved even if you uninstall or reinstall the app.

---

## 2. Step-by-Step: Installing on the Host Computer

Follow these steps on the main computer that will act as your college server:

### Step 1: Run the Installer
1. Locate `CollegeFeeManagement-Setup.exe` (found in `installer_output\`).
2. Right-click the file and select **Run as administrator**.
3. Accept the administrator prompt (UAC).

### Step 2: Choose Data Directory
1. Choose where your database will be stored (Default: `C:\CollegeData`).
2. Click **Next** and proceed through the installation.
3. The installer will automatically:
   - Install the application binaries and standalone Node runtime.
   - Configure Windows Firewall rules for Port 5000 and `node.exe`.
   - Create Desktop and Start Menu shortcuts.

### Step 3: Launch the Application
1. Check the box **Launch College Fee Management now** or double-click the desktop shortcut **College Fee Management**.
2. The native background launcher will start the backend service silently and automatically open your default browser to:
   ```text
   http://localhost:5000
   ```
3. Log in with your admin credentials.

---

## 3. Step-by-Step: Accessing from Other Devices (Phones / Laptops)

Once the app is running on the Host Computer, anyone in your office or counter can use it from their phone or laptop.

### Step 1: Ensure Same Wi-Fi Connection
- Connect the Host PC and the secondary device (phone/laptop) to the **same Wi-Fi network**.
- **Important for mobile phones:** Temporarily turn **OFF** Mobile Data (4G/5G) so all traffic flows through the local Wi-Fi.

### Step 2: Find the Host's Wi-Fi Address
1. On the Host PC, look at the top navigation bar and click the **Wi-Fi icon** ("Run on Local Wi-Fi").
2. Note the address shown (Example: `http://192.168.1.15:5000`).

### Step 3: Open on the Other Device
* **Option A (QR Code):** Open the camera app on your phone and scan the QR code displayed in the Wi-Fi modal.
* **Option B (Browser URL):** Open Chrome or Safari on the second device and type the exact address:
  ```text
  http://<HOST_IP_ADDRESS>:5000
  ```
  *(Example: `http://192.168.1.15:5000` — always use `http://`, not `https://`).*

### Step 4: Add to Phone Home Screen (Optional App-like Experience)
- In Chrome on Android: Tap the 3 dots menu $\rightarrow$ **Add to Home screen**.
- In Safari on iPhone: Tap the Share button $\rightarrow$ **Add to Home Screen**.
- The app will now open fullscreen just like a native mobile app!

---

## 4. Step-by-Step: Moving the App to a New Device

If you need to switch the host computer to a different laptop or desktop:

### Step 1: Backup Data from Old Computer
1. Open Windows File Explorer on the old computer.
2. Go to `C:\CollegeData` (or your custom data folder).
3. Copy the entire `C:\CollegeData` folder (which contains `college.db` and the `uploads` directory) to a USB flash drive or Google Drive.

### Step 2: Uninstall from Old Computer (Optional)
1. Go to Windows **Settings $\rightarrow$ Installed Apps** (or Start Menu $\rightarrow$ **Uninstall College Fee Management**).
2. Follow the prompt to remove the software. *(Your `C:\CollegeData` folder will remain intact).*

### Step 3: Install on New Computer
1. Copy your `CollegeData` backup folder from the USB drive to the new computer at `C:\CollegeData`.
2. Run `CollegeFeeManagement-Setup.exe` on the new computer as Administrator.
3. Select `C:\CollegeData` as the data directory when prompted.
4. Complete the installation and launch the app.
5. All students, fees, logs, and photos are instantly available on the new device!

---

## 5. Troubleshooting: "This Site Can't Be Reached"

If another device cannot open the page, check the following items in order:

### 1. Check Port Number (Must be 5000)
- In the installed version, the app runs on **port 5000** (e.g., `http://192.168.1.15:5000`).
- If you or your QR code try to open port **5173** (e.g., `http://192.168.1.15:5173`), the browser will report "Site can't be reached" because port 5173 is only used during developer testing.

### 2. Set Windows Wi-Fi Network to "Private"
Windows Defender Firewall restricts incoming connections if your Wi-Fi is marked as "Public":
1. On the Host PC, click the Wi-Fi icon on the taskbar $\rightarrow$ click **Properties** of your connected network.
2. Under "Network profile type", select **Private network** (instead of Public).

### 3. Check Windows Firewall
If incoming connections are blocked:
1. Open the project or app folder.
2. Right-click `allow-wifi-firewall.bat` and select **Run as administrator**.
3. This unblocks port 5000 and allows all incoming traffic from the local Wi-Fi.

### 4. Check Wi-Fi Router Settings (AP / Client Isolation)
- Some commercial, hostel, or guest Wi-Fi networks enable a security feature called **"AP Isolation"** or **"Client Isolation"**.
- This feature blocks connected devices from communicating with one another.
- **Quick Test:** Turn on **Mobile Hotspot** on your phone, connect the laptop to your phone's hotspot, and try opening the hotspot IP on your phone. If it works on the hotspot but not on your office Wi-Fi, the router has AP Isolation enabled. Ask your network administrator to disable Client Isolation or connect to the main office network.

### 5. Check Mobile Phone Settings
- Turn **OFF Mobile Data** (4G/5G). Some phones prioritize cellular internet and refuse to look up local private Wi-Fi IPs when mobile data is active.
- Verify that the URL starts with `http://` and **not** `https://`.
