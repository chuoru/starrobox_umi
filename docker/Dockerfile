# Ubuntu 22.04 image that builds ORB-SLAM3 and its dependencies.
# Build from the repo root: docker build -f docker/Dockerfile -t starrobox-umi:dev .
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
		build-essential cmake git ca-certificates pkg-config \
		libeigen3-dev libopencv-dev libboost-serialization-dev libssl-dev \
		libgl1-mesa-dev libglew-dev libwayland-dev libxkbcommon-dev \
		wayland-protocols libepoxy-dev libpython3-dev \
		xvfb xauth python3 python3-pip \
	&& rm -rf /var/lib/apt/lists/*

ARG PANGOLIN_REF=v0.8
ARG ORBSLAM3_REF=v1.0-release
ARG JOBS=4

# Pangolin: the viewer that ORB-SLAM3 links against.
RUN git clone --depth 1 --branch ${PANGOLIN_REF} https://github.com/stevenlovegrove/Pangolin.git /opt/Pangolin \
	&& cmake -S /opt/Pangolin -B /opt/Pangolin/build -DCMAKE_BUILD_TYPE=Release \
	&& cmake --build /opt/Pangolin/build -j${JOBS} \
	&& cmake --install /opt/Pangolin/build \
	&& ldconfig

# ORB-SLAM3. Ubuntu 22.04 ships Eigen and OpenCV versions that need C++14.
RUN git clone --depth 1 --branch ${ORBSLAM3_REF} https://github.com/UZ-SLAMLab/ORB_SLAM3.git /opt/ORB_SLAM3 \
	&& cd /opt/ORB_SLAM3 \
	&& grep -rl "std=c++11" --include=CMakeLists.txt . | xargs sed -i 's/std=c++11/std=c++14/g' \
	&& sed -i 's/++11/++14/g' CMakeLists.txt \
	&& (cd Thirdparty/DBoW2 && mkdir -p build && cd build && cmake .. -DCMAKE_BUILD_TYPE=Release && make -j${JOBS}) \
	&& (cd Thirdparty/g2o && mkdir -p build && cd build && cmake .. -DCMAKE_BUILD_TYPE=Release && make -j${JOBS}) \
	&& (cd Vocabulary && tar -xf ORBvoc.txt.tar.gz) \
	&& mkdir -p build && cd build && cmake .. -DCMAKE_BUILD_TYPE=Release && make -j${JOBS}

ENV ORB_SLAM3_ROOT=/opt/ORB_SLAM3
WORKDIR /workspace

# Backend runtime. The web UI is served by Vite in development and by the backend in production.
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip3 install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt
